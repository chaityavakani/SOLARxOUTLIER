import { prisma } from '../../core/prisma.js';
import { badRequest, notFound } from '../../core/AppError.js';
import { nextCode } from '../../core/codes.js';
import { logAudit } from '../../core/audit.js';
import { notifyRole, notifyUsers } from '../../core/notify.js';

const OPEN_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED'];

function withOverdue(lead) {
  const overdue =
    OPEN_STATUSES.includes(lead.status) &&
    !lead.firstContactedAt &&
    Date.now() - new Date(lead.createdAt).getTime() > 24 * 60 * 60 * 1000;
  return { ...lead, isOverdue: overdue };
}

export async function listLeads({ q, status, source, assignedTo, overdue, page, pageSize, skip, take }) {
  const where = {};
  if (status) where.status = status;
  if (source) where.source = source;
  if (assignedTo) where.assignedToId = assignedTo;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { code: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (overdue === 'true') {
    where.status = { in: OPEN_STATUSES };
    where.firstContactedAt = null;
    where.createdAt = { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) };
  }
  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { surveys: true, quotes: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.lead.count({ where }),
  ]);
  return { items: items.map(withOverdue), total };
}

/**
 * Creates an enquiry. BR-01: duplicates are linked, never rejected.
 */
export async function createLead(data, actor, ip) {
  const duplicate = data.phone
    ? await prisma.lead.findFirst({ where: { phone: data.phone }, orderBy: { createdAt: 'desc' } })
    : null;
  const customer = data.phone
    ? await prisma.customer.findFirst({ where: { phone: data.phone } })
    : null;
  let assignedToId = data.assignedToId || null;
  if (!assignedToId) {
    const salesUsers = await prisma.user.findMany({
      where: { role: 'SALES_EXECUTIVE', isActive: true },
      select: { id: true, _count: { select: { leadsAssigned: { where: { status: { in: OPEN_STATUSES } } } } } },
    });
    assignedToId = salesUsers.sort((a, b) => a._count.leadsAssigned - b._count.leadsAssigned)[0]?.id || null;
  }

  const lead = await prisma.$transaction(async (tx) => {
    const code = await nextCode('ENQ', tx);
    const row = await tx.lead.create({
      data: {
        code,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        pincode: data.pincode || null,
        source: data.source || 'WEB_FORM',
        requestedSystemType: data.requestedSystemType || 'NOT_SURE',
        requestedCapacityKw: data.requestedCapacityKw ?? null,
        wantsSubsidy: data.wantsSubsidy ?? false,
        monthlyBillInr: data.monthlyBillInr ?? null,
        roofAreaSqft: data.roofAreaSqft ?? null,
        gridConnectionOk: data.gridConnectionOk ?? null,
        sanctionedLoadKw: data.sanctionedLoadKw ?? null,
        qualificationNotes: data.qualificationNotes || null,
        customerId: customer?.id || null,
        duplicateOfId: duplicate?.id || null,
        assignedToId,
      },
    });
    await tx.leadActivity.create({
      data: {
        leadId: row.id,
        userId: actor?.id || null,
        type: 'NOTE',
        message: duplicate
          ? `Enquiry received. Linked to existing enquiry ${duplicate.code} (same phone).`
          : 'Enquiry received from ' + (data.source || 'WEB_FORM').toLowerCase().replace('_', ' ') + '.',
      },
    });
    return row;
  });

  await notifyRole('SALES_EXECUTIVE', {
    title: `New enquiry ${lead.code}`,
    body: `${lead.name} · ${lead.city || 'Hyderabad'} · ${lead.requestedCapacityKw || '—'} kW`,
    link: `/sales/leads/${lead.id}`,
  });
  await logAudit({
    userId: actor?.id,
    action: 'LEAD_CREATED',
    entityType: 'Lead',
    entityId: lead.id,
    after: { code: lead.code, name: lead.name, phone: lead.phone },
    ip,
  });
  return { ...lead, duplicateOf: duplicate ? { id: duplicate.id, code: duplicate.code } : null };
}

export async function getLead(id) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      customer: true,
      duplicateOf: { select: { id: true, code: true, status: true } },
      duplicates: { select: { id: true, code: true, status: true, createdAt: true } },
      activities: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      },
      surveys: {
        include: { technician: { select: { id: true, name: true, phone: true } } },
        orderBy: { scheduledAt: 'desc' },
      },
      quotes: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!lead) throw notFound('Enquiry not found.');
  return withOverdue(lead);
}

export async function updateLead(id, data, actor, ip) {
  const before = await prisma.lead.findUnique({ where: { id } });
  if (!before) throw notFound('Enquiry not found.');
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email === '' ? null : data.email,
      address: data.address,
      city: data.city,
      pincode: data.pincode,
      requestedSystemType: data.requestedSystemType,
      requestedCapacityKw: data.requestedCapacityKw,
      wantsSubsidy: data.wantsSubsidy,
      monthlyBillInr: data.monthlyBillInr,
      roofAreaSqft: data.roofAreaSqft,
      gridConnectionOk: data.gridConnectionOk,
      sanctionedLoadKw: data.sanctionedLoadKw,
      qualificationNotes: data.qualificationNotes,
      source: data.source,
    },
  });
  await logAudit({
    userId: actor.id,
    action: 'LEAD_UPDATED',
    entityType: 'Lead',
    entityId: id,
    before: { name: before.name, city: before.city },
    after: { name: lead.name, city: lead.city },
    ip,
  });
  return lead;
}

export async function addActivity(id, data, actor) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw notFound('Enquiry not found.');
  const touched = !lead.firstContactedAt && ['CALL', 'WHATSAPP', 'VISIT'].includes(data.type);
  const result = await prisma.$transaction(async (tx) => {
    const activity = await tx.leadActivity.create({
      data: { leadId: id, userId: actor.id, type: data.type, message: data.message },
    });
    if (touched) {
      await tx.lead.update({
        where: { id },
        data: {
          firstContactedAt: new Date(),
          status: lead.status === 'NEW' ? 'CONTACTED' : lead.status,
        },
      });
      await tx.leadActivity.create({
        data: { leadId: id, userId: actor.id, type: 'STATUS_CHANGE', message: 'Marked contacted after first call.' },
      });
    }
    return activity;
  });
  return result;
}

export async function qualifyLead(id, data, actor) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw notFound('Enquiry not found.');
  if (['WON', 'LOST', 'SURVEY_APPROVED', 'QUOTED'].includes(lead.status)) {
    throw badRequest('This enquiry is already past qualification.', 'INVALID_TRANSITION');
  }
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: data.qualified ? 'QUALIFIED' : 'NOT_QUALIFIED',
      qualificationNotes: data.notes,
      firstContactedAt: lead.firstContactedAt || new Date(),
      requestedCapacityKw: data.requestedCapacityKw ?? lead.requestedCapacityKw,
      requestedSystemType: data.requestedSystemType ?? lead.requestedSystemType,
      wantsSubsidy: data.wantsSubsidy ?? lead.wantsSubsidy,
      monthlyBillInr: data.monthlyBillInr ?? lead.monthlyBillInr,
      roofAreaSqft: data.roofAreaSqft ?? lead.roofAreaSqft,
      gridConnectionOk: data.gridConnectionOk ?? lead.gridConnectionOk,
      sanctionedLoadKw: data.sanctionedLoadKw ?? lead.sanctionedLoadKw,
    },
  });
  await prisma.leadActivity.create({
    data: {
      leadId: id,
      userId: actor.id,
      type: 'STATUS_CHANGE',
      message: data.qualified ? 'Qualified for a site survey.' : 'Not qualified — ' + (data.notes || 'no reason given'),
    },
  });
  return updated;
}

export async function assignLead(id, assignedToId, actor) {
  const lead = await prisma.lead.update({ where: { id }, data: { assignedToId } });
  await prisma.leadActivity.create({
    data: { leadId: id, userId: actor.id, type: 'STATUS_CHANGE', message: 'Enquiry reassigned.' },
  });
  await notifyUsers([assignedToId], {
    title: `Enquiry ${lead.code} assigned to you`,
    body: `${lead.name} · ${lead.phone}`,
    link: `/sales/leads/${lead.id}`,
  });
  return lead;
}

export async function markLost(id, reason, actor) {
  const lead = await prisma.lead.update({
    where: { id },
    data: { status: 'LOST', lostReason: reason },
  });
  await prisma.leadActivity.create({
    data: { leadId: id, userId: actor.id, type: 'STATUS_CHANGE', message: `Marked lost — ${reason}` },
  });
  return lead;
}
