import { prisma } from '../../core/prisma.js';
import { badRequest, conflict, notFound } from '../../core/AppError.js';
import { nextCode } from '../../core/codes.js';
import { emitEvent } from '../../core/events.js';
import { notifyRole } from '../../core/notify.js';

const dispatchInclude = {
  project: { include: { customer: true, quote: { include: { items: true } } } },
  lines: { include: { product: true } },
  serialUnits: { include: { product: true } },
};

export async function createDispatchForProject(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { quote: { include: { items: true } }, dispatch: true },
  });
  if (!project) throw notFound('Project not found.');
  if (project.dispatch) return prisma.dispatch.findUnique({ where: { id: project.dispatch.id }, include: dispatchInclude });
  const dispatch = await prisma.$transaction(async (tx) => {
    const number = await nextCode('DSP', tx);
    const row = await tx.dispatch.create({
      data: {
        number,
        projectId,
        lines: {
          create: project.quote.items
            .filter((item) => item.productId)
            .map((item) => ({ productId: item.productId, requiredQty: item.quantity })),
        },
      },
      include: dispatchInclude,
    });
    const technician = await tx.user.findFirst({
      where: { role: 'INSTALLATION_TECHNICIAN', isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    await tx.installationJob.create({
      data: {
        projectId,
        ...(technician ? { crew: { create: { technicianId: technician.id, isLead: true } } } : {}),
      },
    });
    return row;
  });
  await notifyRole('WAREHOUSE_MANAGER', {
    title: `Dispatch ${dispatch.number} is ready`,
    body: `Pack the materials for ${project.code}.`,
    link: `/warehouse/dispatches/${dispatch.id}`,
  });
  return dispatch;
}

export async function listDispatches(status) {
  if (!status) {
    const confirmedProjects = await prisma.project.findMany({
      where: { status: 'CONFIRMED', dispatch: null },
      select: { id: true },
    });
    for (const project of confirmedProjects) {
      await createDispatchForProject(project.id);
    }
  }
  return prisma.dispatch.findMany({
    where: status ? { status } : undefined,
    include: dispatchInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDispatch(id) {
  const row = await prisma.dispatch.findUnique({ where: { id }, include: dispatchInclude });
  if (!row) throw notFound('Dispatch not found.');
  return row;
}

export async function scanSerial(id, serialNumber) {
  const dispatch = await getDispatch(id);
  if (!['PENDING', 'PACKING', 'READY'].includes(dispatch.status)) throw conflict('This dispatch is no longer being packed.', 'DISPATCH_LOCKED');
  const serial = await prisma.serialUnit.findUnique({ where: { serialNumber }, include: { product: true } });
  if (!serial) throw notFound(`Serial ${serialNumber} was not found.`, 'SERIAL_NOT_FOUND');
  if (serial.status !== 'IN_STOCK') throw conflict(`${serialNumber} is already ${serial.status.toLowerCase().replace('_', ' ')}.`, 'SERIAL_NOT_AVAILABLE');
  const line = dispatch.lines.find((item) => item.productId === serial.productId);
  if (!line) throw badRequest(`${serialNumber} does not belong to this dispatch.`, 'SERIAL_PRODUCT_MISMATCH');
  if (line.scannedQty >= Number(line.requiredQty)) throw conflict('This dispatch line is already complete.', 'LINE_COMPLETE');
  await prisma.$transaction(async (tx) => {
    await tx.serialUnit.update({ where: { id: serial.id }, data: { status: 'RESERVED', projectId: dispatch.projectId, dispatchId: id } });
    await tx.dispatchLine.update({ where: { id: line.id }, data: { scannedQty: { increment: 1 } } });
    await tx.dispatch.update({ where: { id }, data: { status: 'PACKING' } });
  });
  // Fetch fresh data after transaction so completion check sees updated counts
  const fresh = await getDispatch(id);
  const complete = fresh.lines.every((item) => item.product.isSerialized
    ? item.scannedQty >= Number(item.requiredQty)
    : item.packedQty >= Number(item.requiredQty));
  if (complete) await prisma.dispatch.update({ where: { id }, data: { status: 'READY' } });
  return getDispatch(id);
}

export async function markPacked(id, lineId, quantity) {
  const line = await prisma.dispatchLine.findFirst({ where: { id: lineId, dispatchId: id } });
  if (!line) throw notFound('Dispatch line not found.');
  if (quantity > Number(line.requiredQty)) throw badRequest('Packed quantity cannot exceed the required quantity.', 'INVALID_QUANTITY');
  await prisma.dispatchLine.update({ where: { id: lineId }, data: { packedQty: quantity } });
  const fresh = await getDispatch(id);
  const complete = fresh.lines.every((item) => item.product.isSerialized
    ? item.scannedQty >= Number(item.requiredQty)
    : item.packedQty >= Number(item.requiredQty));
  if (complete) await prisma.dispatch.update({ where: { id }, data: { status: 'READY' } });
  return getDispatch(id);
}

export async function dispatchOrder(id, data, actor) {
  const dispatch = await getDispatch(id);
  const incomplete = dispatch.lines.filter((line) => line.product.isSerialized
    ? line.scannedQty < Number(line.requiredQty)
    : line.packedQty < Number(line.requiredQty));
  if (incomplete.length) throw conflict('Every dispatch line must be complete before dispatch.', 'DISPATCH_INCOMPLETE');
  const updated = await prisma.$transaction(async (tx) => {
    await tx.serialUnit.updateMany({ where: { dispatchId: id, status: 'RESERVED' }, data: { status: 'DISPATCHED' } });
    for (const line of dispatch.lines.filter((item) => !item.product.isSerialized)) {
      await tx.product.update({ where: { id: line.productId }, data: { stockQty: { decrement: Number(line.packedQty) } } });
    }
    return tx.dispatch.update({
      where: { id },
      data: { status: 'DISPATCHED', packedById: actor.id, vehicleNo: data.vehicleNo, driverName: data.driverName, driverPhone: data.driverPhone, dispatchedAt: new Date() },
      include: dispatchInclude,
    });
  });
  await prisma.project.update({ where: { id: dispatch.projectId }, data: { status: 'DISPATCHED' } });
  emitEvent('dispatch.dispatched', { dispatchId: id, projectId: dispatch.projectId });
  return updated;
}

export async function deliverDispatch(id, receivedByName) {
  const dispatch = await getDispatch(id);
  if (dispatch.status !== 'DISPATCHED') throw conflict('Only dispatched orders can be delivered.', 'INVALID_TRANSITION');
  const deliveredAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.serialUnit.updateMany({ where: { dispatchId: id, status: 'DISPATCHED' }, data: { status: 'DELIVERED' } });
    const serials = await tx.serialUnit.findMany({ where: { dispatchId: id }, include: { product: true } });
    // Warranties for serialized products (one per serial unit)
    for (const serial of serials) {
      const warrantyEnd = new Date(deliveredAt);
      warrantyEnd.setMonth(warrantyEnd.getMonth() + serial.product.warrantyMonths);
      await tx.warranty.upsert({
        where: { serialUnitId: serial.id },
        update: { startDate: deliveredAt, endDate: warrantyEnd },
        create: {
          serialUnitId: serial.id,
          productId: serial.productId,
          customerId: dispatch.project.customerId,
          projectId: dispatch.projectId,
          startDate: deliveredAt,
          endDate: warrantyEnd,
        },
      });
    }
    // Warranties for non-serialized products (one per product per project)
    for (const line of dispatch.lines.filter((l) => !l.product.isSerialized)) {
      const warrantyEnd = new Date(deliveredAt);
      warrantyEnd.setMonth(warrantyEnd.getMonth() + line.product.warrantyMonths);
      await tx.warranty.upsert({
        where: { productId_projectId: { productId: line.productId, projectId: dispatch.projectId } },
        update: { startDate: deliveredAt, endDate: warrantyEnd },
        create: {
          productId: line.productId,
          customerId: dispatch.project.customerId,
          projectId: dispatch.projectId,
          startDate: deliveredAt,
          endDate: warrantyEnd,
        },
      });
    }
    return tx.dispatch.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt, receivedByName }, include: dispatchInclude });
  });
  await prisma.project.update({ where: { id: dispatch.projectId }, data: { status: 'DELIVERED', deliveredAt } });
  emitEvent('dispatch.delivered', { dispatchId: id, projectId: dispatch.projectId });
  return updated;
}
