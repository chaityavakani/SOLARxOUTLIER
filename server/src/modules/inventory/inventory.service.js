import { prisma } from '../../core/prisma.js';
import { badRequest, conflict, notFound } from '../../core/AppError.js';
import { nextCode } from '../../core/codes.js';

export async function listProducts(q) {
  return prisma.product.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { name: 'asc' },
  });
}

export async function listSerials(q) {
  return prisma.serialUnit.findMany({
    where: q
      ? {
          OR: [
            { serialNumber: { contains: q, mode: 'insensitive' } },
            { product: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : undefined,
    include: { product: true, warranty: true, project: { include: { customer: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listWarranties(q) {
  const where = q
    ? {
        OR: [
          { serialUnit: { serialNumber: { contains: q, mode: 'insensitive' } } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { customer: { phone: { contains: q, mode: 'insensitive' } } },
          { project: { code: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : undefined;

  const now = new Date();
  const warranties = await prisma.warranty.findMany({
    where,
    include: {
      serialUnit: { include: { product: true } },
      customer: true,
      project: true,
    },
    orderBy: { endDate: 'asc' },
  });

  return warranties.map((w) => {
    const isUnderWarranty = w.startDate <= now && w.endDate >= now && !w.voidReason;
    const daysRemaining = w.endDate > now ? Math.ceil((new Date(w.endDate) - now) / (1000 * 60 * 60 * 24)) : 0;
    return {
      ...w,
      isUnderWarranty,
      daysRemaining,
    };
  });
}

export async function createPurchase(data, actor) {
  const supplier = await prisma.supplier.upsert({
    where: { id: data.supplierId || '__new__' },
    update: {},
    create: { name: data.supplierName || 'Local Supplier' },
  });
  const serials = data.items.flatMap((item) => item.serialNumbers || []);
  if (new Set(serials).size !== serials.length) {
    throw conflict('Serial numbers must be unique within a purchase.', 'DUPLICATE_SERIALS');
  }
  const existing = await prisma.serialUnit.findMany({
    where: { serialNumber: { in: serials } },
    select: { serialNumber: true },
  });
  if (existing.length) {
    throw conflict(
      `These serials already exist: ${existing.map((s) => s.serialNumber).join(', ')}`,
      'SERIAL_ALREADY_EXISTS'
    );
  }
  const total = data.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        number: await nextCode('PUR', tx),
        supplierId: supplier.id,
        invoiceRef: data.invoiceRef,
        purchasedAt: data.purchasedAt ? new Date(data.purchasedAt) : new Date(),
        total,
        createdById: actor.id,
      },
    });
    for (const item of data.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw notFound('Product not found.');
      if (product.isSerialized && (item.serialNumbers || []).length !== Number(item.quantity)) {
        throw badRequest(`Enter exactly ${item.quantity} serials for ${product.name}.`, 'SERIAL_COUNT_MISMATCH');
      }
      const line = await tx.purchaseItem.create({
        data: { purchaseId: purchase.id, productId: item.productId, quantity: item.quantity, unitCost: item.unitCost },
      });
      if (product.isSerialized) {
        await tx.serialUnit.createMany({
          data: item.serialNumbers.map((serialNumber) => ({
            serialNumber,
            productId: item.productId,
            purchaseItemId: line.id,
            unitCost: item.unitCost,
          })),
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity }, costPrice: item.unitCost },
        });
      }
    }
    return tx.purchase.findUnique({
      where: { id: purchase.id },
      include: { items: { include: { product: true, serialUnits: true } } },
    });
  });
}
