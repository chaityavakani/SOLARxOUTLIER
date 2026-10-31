import { prisma } from '../../core/prisma.js';
import { badRequest, forbidden, notFound } from '../../core/AppError.js';
import { nextCode } from '../../core/codes.js';
import { getSetting } from '../../core/settings.js';
import { emitEvent } from '../../core/events.js';

const include = {
  customer: true,
  project: true,
  serialUnit: { include: { product: true, warranty: true } },
  assignedTo: { select: { id: true, name: true, phone: true } },
  activities: { orderBy: { createdAt: 'asc' } },
  parts: true,
};

function activeWarranty(serial) {
  return Boolean(
    serial?.warranty &&
    serial.warranty.startDate <= new Date() &&
    serial.warranty.endDate >= new Date() &&
    !serial.warranty.voidReason
  );
}

export async function listTickets(user) {
  const where = user.role === 'CUSTOMER' ? { customerId: user.customer?.id || '__none__' } : undefined;
  return prisma.ticket.findMany({ where, include, orderBy: { createdAt: 'desc' } });
}

export async function getTicket(id, user) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include });
  if (!ticket) throw notFound('Ticket not found.');
  if (user.role === 'CUSTOMER' && ticket.customerId !== user.customer?.id) {
    throw forbidden('This ticket belongs to another customer.');
  }
  return ticket;
}

/**
 * Instant lookup for customer & serial numbers during service calls (Scene 5).
 * Matches serial number, customer phone, customer name, or project code.
 */
export async function lookupWarranty(q) {
  if (!q || !q.trim()) return [];
  const query = q.trim();

  const serials = await prisma.serialUnit.findMany({
    where: {
      OR: [
        { serialNumber: { contains: query, mode: 'insensitive' } },
        { project: { customer: { phone: { contains: query, mode: 'insensitive' } } } },
        { project: { customer: { name: { contains: query, mode: 'insensitive' } } } },
        { project: { code: { contains: query, mode: 'insensitive' } } },
      ],
    },
    include: {
      product: true,
      warranty: true,
      project: {
        include: {
          customer: true,
        },
      },
      tickets: {
        orderBy: { createdAt: 'desc' },
      },
    },
    take: 15,
  });

  const now = new Date();

  return serials.map((serial) => {
    const isUnderWarranty = activeWarranty(serial);
    const endDate = serial.warranty?.endDate ? new Date(serial.warranty.endDate) : null;
    const daysRemaining = endDate && endDate > now
      ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      id: serial.id,
      serialNumber: serial.serialNumber,
      status: serial.status,
      product: {
        id: serial.product.id,
        name: serial.product.name,
        category: serial.product.category,
        brand: serial.product.brand,
        warrantyMonths: serial.product.warrantyMonths,
        sellPrice: Number(serial.product.sellPrice),
      },
      customer: serial.project?.customer ? {
        id: serial.project.customer.id,
        name: serial.project.customer.name,
        phone: serial.project.customer.phone,
        email: serial.project.customer.email,
        address: serial.project.customer.addressLine,
        city: serial.project.customer.city,
      } : null,
      project: serial.project ? {
        id: serial.project.id,
        code: serial.project.code,
        capacityKw: Number(serial.project.capacityKw),
        systemType: serial.project.systemType,
        installedAt: serial.project.installedAt,
      } : null,
      warranty: serial.warranty ? {
        id: serial.warranty.id,
        startDate: serial.warranty.startDate,
        endDate: serial.warranty.endDate,
        voidReason: serial.warranty.voidReason,
        isUnderWarranty,
        daysRemaining,
      } : null,
      billingPolicy: isUnderWarranty ? {
        coverage: 'WARRANTY_COVERED',
        customerCost: 0,
        label: '100% Free Warranty Repair',
        description: 'Parts, diagnostics, and labour covered at zero cost to customer.',
      } : {
        coverage: 'BILLABLE',
        customerCost: 'Standard Rates',
        label: 'Chargeable Service',
        description: 'Warranty expired or not registered. Labor ₹350/hr + ₹500 visit + replacement parts.',
      },
      recentTickets: serial.tickets.slice(0, 3).map((t) => ({
        id: t.id,
        number: t.number,
        status: t.status,
        faultCode: t.faultCode,
        createdAt: t.createdAt,
      })),
    };
  });
}

export async function createTicket(data, actor) {
  const serial = data.serialUnitId
    ? await prisma.serialUnit.findUnique({ where: { id: data.serialUnitId }, include: { warranty: true, project: true } })
    : null;
  if (data.serialUnitId && !serial) throw notFound('Serial unit not found.');

  const customerId = actor.role === 'CUSTOMER' ? actor.customer.id : (data.customerId || serial?.project?.customerId);
  if (!customerId) throw badRequest('Choose a customer.', 'CUSTOMER_REQUIRED');

  const isWarranty = activeWarranty(serial);

  const ticket = await prisma.$transaction(async (tx) => {
    const number = await nextCode('TKT', tx);
    const row = await tx.ticket.create({
      data: {
        number,
        customerId,
        projectId: data.projectId || serial?.projectId,
        serialUnitId: data.serialUnitId || null,
        source: actor.role === 'CUSTOMER' ? 'PORTAL' : data.source || 'PHONE',
        category: data.category,
        faultCode: data.faultCode,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        isUnderWarranty: isWarranty,
        isChargeable: !isWarranty,
        createdById: actor.id,
      },
      include,
    });
    await tx.ticketActivity.create({
      data: {
        ticketId: row.id,
        userId: actor.id,
        type: 'CREATED',
        message: `Ticket created for ${row.category}${data.faultCode ? ` (Fault code: ${data.faultCode})` : ''}. ${isWarranty ? 'Covered under warranty.' : 'Out of warranty — chargeable.'}`,
      },
    });
    return row;
  });

  emitEvent('ticket.created', { ticketId: ticket.id });
  return ticket;
}

export async function resolveTicket(id, data, actor) {
  const ticket = await getTicket(id, actor);
  if (!['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'REOPENED'].includes(ticket.status)) {
    throw badRequest('This ticket cannot be resolved.', 'INVALID_TRANSITION');
  }
  const underWarranty = Boolean(ticket.isUnderWarranty);
  const labourRate = Number(await getSetting('labourRatePerHour')) || 350;
  const visitCharge = Number(await getSetting('serviceVisitCharge')) || 500;
  const partsTotal = (data.parts || []).reduce((sum, part) => sum + Number(part.quantity) * Number(part.unitPrice), 0);
  const total = underWarranty ? 0 : partsTotal + Number(data.labourHours || 0) * labourRate + visitCharge;

  const updated = await prisma.$transaction(async (tx) => {
    if (data.parts?.length) {
      await tx.ticketPart.createMany({
        data: data.parts.map((part) => ({
          ticketId: id,
          productId: part.productId,
          quantity: part.quantity,
          unitPrice: part.unitPrice,
          unitCost: part.unitCost || part.unitPrice,
        })),
      });
    }
    await tx.ticketActivity.create({
      data: {
        ticketId: id,
        userId: actor.id,
        type: 'RESOLVED',
        message: underWarranty
          ? 'Resolved under warranty at no charge.'
          : `Resolved. Chargeable total ₹${total.toLocaleString('en-IN')} (Parts: ₹${partsTotal}, Labour: ₹${Number(data.labourHours || 0) * labourRate}, Visit: ₹${visitCharge}).`,
      },
    });
    return tx.ticket.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
      include,
    });
  });

  emitEvent('ticket.resolved', { ticketId: id, total, underWarranty });
  return { ...updated, chargeableTotal: total };
}

export async function confirmResolution(id, note, actor) {
  const ticket = await getTicket(id, actor);
  if (ticket.status !== 'RESOLVED') throw badRequest('Only resolved tickets can be confirmed.', 'INVALID_TRANSITION');
  return prisma.ticket.update({
    where: { id },
    data: {
      status: 'CLOSED',
      customerConfirmedAt: new Date(),
      confirmationNote: note,
    },
    include,
  });
}
