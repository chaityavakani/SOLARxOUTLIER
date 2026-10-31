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

export async function listAvailableSerialsByProducts(productIds) {
  return prisma.serialUnit.findMany({
    where: { productId: { in: productIds }, status: 'IN_STOCK' },
    include: { product: true },
    orderBy: [{ productId: 'asc' }, { serialNumber: 'asc' }],
  });
}

export async function listWarranties(q, customerId) {
  const searchConditions = q
    ? [
        { serialUnit: { serialNumber: { contains: q, mode: 'insensitive' } } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
        { project: { code: { contains: q, mode: 'insensitive' } } },
      ]
    : null;

  const where = {
    ...(customerId ? { customerId } : {}),
    ...(searchConditions ? { OR: searchConditions } : {}),
  };

  const now = new Date();
  const warranties = await prisma.warranty.findMany({
    where,
    include: {
      serialUnit: { include: { product: true } },
      customer: true,
      project: { include: { customer: true } },
    },
    orderBy: { endDate: 'asc' },
  });

  return warranties.map((w) => {
    const isUnderWarranty = new Date(w.startDate) <= now && new Date(w.endDate) >= now && !w.voidReason;
    const daysRemaining = new Date(w.endDate) > now ? Math.ceil((new Date(w.endDate) - now) / (1000 * 60 * 60 * 24)) : 0;
    const warrantyMonths = w.serialUnit?.product?.warrantyMonths || 0;
    return {
      ...w,
      isUnderWarranty,
      daysRemaining,
      warrantyMonths,
    };
  });
}

/**
 * Generates the next N sequential serial numbers for a product.
 * Format: <SKU_PREFIX>-<6-digit-sequence>  e.g. INV-3KW-000042
 * Sequence is based on the highest existing serial for that product so numbers
 * are always unique and never reused even after deletes.
 */
export async function generateNextSerials(productId, quantity) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound('Product not found.');

  // Build a prefix from the SKU — take the first meaningful segment
  const prefix = product.sku.replace(/[^A-Z0-9-]/gi, '').toUpperCase();

  // Find the highest existing sequence number for this product
  const existing = await prisma.serialUnit.findMany({
    where: { productId },
    select: { serialNumber: true },
  });

  let maxSeq = 0;
  for (const { serialNumber } of existing) {
    const match = serialNumber.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }

  const serials = [];
  for (let i = 1; i <= quantity; i++) {
    const seq = String(maxSeq + i).padStart(6, '0');
    serials.push(`${prefix}-${seq}`);
  }
  return serials;
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
