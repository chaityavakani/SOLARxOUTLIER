import { prisma } from '../../core/prisma.js';
import { badRequest, forbidden, notFound } from '../../core/AppError.js';
import { nextCode } from '../../core/codes.js';
import { getSettings } from '../../core/settings.js';
import { ensureCustomerLogin } from '../auth/auth.service.js';
import { createProjectFromQuoteTx } from '../projects/projects.service.js';
import { emitEvent } from '../../core/events.js';
import { notifyRole, notifyUsers } from '../../core/notify.js';

const include = {
  customer: true,
  lead: { select: { id: true, code: true, name: true, phone: true, wantsSubsidy: true } },
  kitTemplate: { select: { id: true, name: true } },
  items: { include: { product: true } },
  project: { select: { id: true, code: true, status: true } },
};

function totals(items, discount = 0) {
  const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);
  const taxTotal = items.reduce(
    (s, i) => s + (Number(i.quantity) * Number(i.unitPrice) * Number(i.taxPercent)) / 100,
    0
  );
  const total = subtotal - Number(discount) + taxTotal;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxTotal: Number(taxTotal.toFixed(2)),
    total: Number(Math.max(0, total).toFixed(2)),
  };
}

async function resolveCustomer(tx, lead) {
  if (lead.customerId) return tx.customer.findUnique({ where: { id: lead.customerId } });
  const existing = await tx.customer.findFirst({ where: { phone: lead.phone } });
  if (existing) {
    await tx.lead.update({ where: { id: lead.id }, data: { customerId: existing.id } });
    return existing;
  }
  const customer = await tx.customer.create({
    data: {
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      addressLine: lead.address,
      city: lead.city,
      pincode: lead.pincode,
    },
  });
  await tx.lead.update({ where: { id: lead.id }, data: { customerId: customer.id } });
  return customer;
}

/**
 * Builds a quote from a kit template's BOM.
 * Why: BR-03 — quoting before the survey is approved is how wrong-size kits ship.
 * Flow: load lead + approved survey → load kit with products → copy BOM into
 * quote lines → calculate tax and total → save DRAFT.
 */
export async function createQuote({ leadId, kitTemplateId }, actor) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { surveys: { where: { status: 'APPROVED' }, orderBy: { reviewedAt: 'desc' } } },
  });
  if (!lead) throw notFound('Enquiry not found.');
  if (!lead.surveys.length) {
    throw badRequest('The roof survey must be approved before a quote can be created (BR-03).', 'SURVEY_NOT_APPROVED');
  }
  const kit = await prisma.kitTemplate.findUnique({
    where: { id: kitTemplateId },
    include: { items: { include: { product: true } } },
  });
  if (!kit) throw notFound('Kit template not found.');
  const settings = await getSettings();
  const survey = lead.surveys[0];

  const lines = kit.items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.product.sellPrice);
    const taxPercent = Number(item.product.taxPercent ?? settings.defaultTaxPercent);
    return {
      productId: item.productId,
      description: item.product.name,
      quantity,
      unitPrice,
      taxPercent,
      lineTotal: Number((quantity * unitPrice).toFixed(2)),
    };
  });
  const sums = totals(lines, 0);

  const quote = await prisma.$transaction(async (tx) => {
    const customer = await resolveCustomer(tx, lead);
    const number = await nextCode('QT', tx);
    const validUntil = new Date(Date.now() + Number(settings.quoteValidityDays) * 86400000);
    const row = await tx.quote.create({
      data: {
        number,
        leadId,
        customerId: customer.id,
        kitTemplateId,
        status: 'DRAFT',
        systemType: kit.systemType,
        capacityKw: survey.recommendedCapacityKw || kit.capacityKw,
        ...sums,
        validUntil,
        createdById: actor.id,
        items: { create: lines },
      },
      include,
    });
    await tx.lead.update({ where: { id: leadId }, data: { status: 'QUOTED' } });
    await tx.leadActivity.create({
      data: {
        leadId,
        userId: actor.id,
        type: 'STATUS_CHANGE',
        message: `Quote ${number} created from ${kit.name} — ₹${sums.total.toLocaleString('en-IN')}.`,
      },
    });
    return row;
  });
  return quote;
}

export async function listQuotes({ user, status, q, page, pageSize, skip, take }) {
  const where = {};
  if (status) where.status = status;
  if (user.role === 'CUSTOMER') where.customerId = user.customer?.id || '__none__';
  if (q) {
    where.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.quote.count({ where }),
  ]);
  return { items, total };
}

export async function getQuote(id, user) {
  const quote = await prisma.quote.findUnique({ where: { id }, include });
  if (!quote) throw notFound('Quote not found.');
  if (user.role === 'CUSTOMER' && quote.customerId !== user.customer?.id) {
    throw forbidden('This quote belongs to another customer.');
  }
  return quote;
}

export async function updateQuote(id, data) {
  const quote = await prisma.quote.findUnique({ where: { id }, include: { items: true } });
  if (!quote) throw notFound('Quote not found.');
  if (quote.status !== 'DRAFT') throw badRequest('Only draft quotes can be edited.', 'QUOTE_LOCKED');
  const sums = totals(quote.items, data.discount ?? quote.discount);
  return prisma.quote.update({
    where: { id },
    data: {
      discount: data.discount ?? quote.discount,
      notes: data.notes ?? quote.notes,
      validUntil: data.validUntil ? new Date(data.validUntil) : quote.validUntil,
      ...sums,
    },
    include,
  });
}

export async function replaceQuoteItems(id, items) {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) throw notFound('Quote not found.');
  if (quote.status !== 'DRAFT') throw badRequest('Only draft quotes can be edited.', 'QUOTE_LOCKED');
  const lines = items.map((i) => ({
    ...i,
    lineTotal: Number((Number(i.quantity) * Number(i.unitPrice)).toFixed(2)),
  }));
  const sums = totals(lines, quote.discount);
  return prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId: id } });
    await tx.quoteItem.createMany({ data: lines.map((l) => ({ ...l, quoteId: id })) });
    return tx.quote.update({ where: { id }, data: sums, include });
  });
}

/** Sends the quote: creates the customer portal login if missing, notifies them. */
export async function sendQuote(id, actor) {
  const quote = await prisma.quote.findUnique({ where: { id }, include: { customer: true, lead: true } });
  if (!quote) throw notFound('Quote not found.');
  if (quote.status !== 'DRAFT') throw badRequest('Only a draft quote can be sent.', 'INVALID_TRANSITION');
  const tempPassword = await ensureCustomerLogin(quote.customer);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.quote.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
      include,
    });
    await tx.leadActivity.create({
      data: {
        leadId: quote.leadId,
        userId: actor.id,
        type: 'STATUS_CHANGE',
        message: `Quote ${quote.number} sent to the customer.`,
      },
    });
    return row;
  });
  const customerUser = quote.customer.userId
    ? null
    : await prisma.customer.findUnique({ where: { id: quote.customerId }, include: { user: true } });
  const userId = customerUser?.user?.id;
  if (userId) {
    await notifyUsers([userId], {
      title: `Your quote ${quote.number} is ready`,
      body: `Total ₹${Number(quote.total).toLocaleString('en-IN')} for a ${Number(quote.capacityKw)} kW system.`,
      link: `/portal/quotes`,
    });
  }
  emitEvent('quote.sent', { quoteId: id });
  return { ...updated, customerLoginCreated: Boolean(tempPassword) };
}

/** Accepts a quote and creates the project awaiting advance. */
export async function acceptQuote(id, user) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, lead: true, items: true },
  });
  if (!quote) throw notFound('Quote not found.');
  if (user.role === 'CUSTOMER' && quote.customerId !== user.customer?.id) {
    throw forbidden('This quote belongs to another customer.');
  }
  if (!['DRAFT', 'SENT'].includes(quote.status)) {
    throw badRequest('This quote can no longer be accepted.', 'INVALID_TRANSITION');
  }
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.quote.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: user.id },
    });
    const project = await createProjectFromQuoteTx(tx, { ...quote, customer: quote.customer }, user.id);
    await tx.lead.update({ where: { id: quote.leadId }, data: { status: 'WON' } });
    await tx.leadActivity.create({
      data: {
        leadId: quote.leadId,
        userId: user.id,
        type: 'STATUS_CHANGE',
        message: `Quote accepted. Project ${project.code} created — awaiting advance payment.`,
      },
    });
    return { quote: row, project };
  });
  await notifyRole('SALES_EXECUTIVE', {
    title: 'Quote accepted',
    body: `${quote.customer.name} accepted ${quote.number}. Collect the advance to confirm.`,
    link: `/sales/projects/${result.project.id}`,
  });
  emitEvent('quote.accepted', { quoteId: id, projectId: result.project.id });
  return result;
}

export async function rejectQuote(id, reason, user) {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) throw notFound('Quote not found.');
  if (user.role === 'CUSTOMER' && quote.customerId !== user.customer?.id) {
    throw forbidden('This quote belongs to another customer.');
  }
  return prisma.quote.update({
    where: { id },
    data: { status: 'REJECTED', notes: reason || quote.notes },
  });
}
