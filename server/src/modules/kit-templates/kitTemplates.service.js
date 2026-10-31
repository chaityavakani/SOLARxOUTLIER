import { prisma } from '../../core/prisma.js';
import { badRequest, notFound } from '../../core/AppError.js';

const include = { items: { include: { product: true } } };

/** Sell-price value of a template's BOM. */
export function kitBasePrice(items) {
  return items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.product?.sellPrice ?? 0),
    0
  );
}

/** Margin summary used by the template editor and the template list. */
export function kitMargin(items) {
  const sell = items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.product?.sellPrice ?? 0),
    0
  );
  const cost = items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.product?.costPrice ?? 0),
    0
  );
  const margin = sell - cost;
  return {
    sellTotal: Number(sell.toFixed(2)),
    costTotal: Number(cost.toFixed(2)),
    margin: Number(margin.toFixed(2)),
    marginPercent: sell > 0 ? Number(((margin / sell) * 100).toFixed(1)) : 0,
  };
}

export async function listKitTemplates({ includeInactive = true } = {}) {
  const rows = await prisma.kitTemplate.findMany({
    where: includeInactive ? {} : { isActive: true },
    include,
    orderBy: [{ systemType: 'asc' }, { capacityKw: 'asc' }],
  });
  return rows.map((row) => ({
    ...row,
    itemCount: row.items.length,
    ...kitMargin(row.items),
  }));
}

export async function getKitTemplate(id) {
  const row = await prisma.kitTemplate.findUnique({ where: { id }, include });
  if (!row) throw notFound('Kit template not found.');
  return { ...row, ...kitMargin(row.items) };
}

function assertUniqueProducts(items) {
  const ids = items.map((i) => i.productId);
  if (new Set(ids).size !== ids.length) {
    throw badRequest('The same product appears twice in this kit. Merge the quantities.', 'DUPLICATE_PRODUCT');
  }
}

async function priceItems(items) {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, sellPrice: true },
  });
  if (products.length !== items.length) throw badRequest('One or more products no longer exist.');
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.reduce((sum, i) => sum + Number(i.quantity) * Number(byId.get(i.productId).sellPrice), 0);
}

export async function createKitTemplate(data) {
  assertUniqueProducts(data.items);
  const basePrice = await priceItems(data.items);
  return prisma.kitTemplate.create({
    data: {
      name: data.name,
      systemType: data.systemType,
      capacityKw: data.capacityKw,
      description: data.description,
      isActive: data.isActive ?? true,
      basePrice,
      items: {
        create: data.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          notes: i.notes,
        })),
      },
    },
    include,
  });
}

export async function updateKitTemplate(id, data) {
  const exists = await prisma.kitTemplate.findUnique({ where: { id } });
  if (!exists) throw notFound('Kit template not found.');
  return prisma.kitTemplate.update({
    where: { id },
    data: {
      name: data.name,
      systemType: data.systemType,
      capacityKw: data.capacityKw,
      description: data.description,
      isActive: data.isActive,
    },
    include,
  });
}

export async function replaceKitItems(id, items) {
  const exists = await prisma.kitTemplate.findUnique({ where: { id } });
  if (!exists) throw notFound('Kit template not found.');
  assertUniqueProducts(items);
  const basePrice = await priceItems(items);
  return prisma.$transaction(async (tx) => {
    await tx.kitTemplateItem.deleteMany({ where: { kitTemplateId: id } });
    await tx.kitTemplateItem.createMany({
      data: items.map((i) => ({
        kitTemplateId: id,
        productId: i.productId,
        quantity: i.quantity,
        notes: i.notes,
      })),
    });
    return tx.kitTemplate.update({ where: { id }, data: { basePrice }, include });
  });
}

export async function duplicateKitTemplate(id, { name, capacityKw }) {
  const source = await prisma.kitTemplate.findUnique({ where: { id }, include });
  if (!source) throw notFound('Kit template not found.');
  return prisma.kitTemplate.create({
    data: {
      name: name || `${source.name} (copy)`,
      systemType: source.systemType,
      capacityKw: capacityKw ?? source.capacityKw,
      description: source.description,
      basePrice: source.basePrice,
      isActive: true,
      items: {
        create: source.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          notes: i.notes,
        })),
      },
    },
    include,
  });
}
