import { prisma } from '../../core/prisma.js';
import { badRequest, forbidden, notFound } from '../../core/AppError.js';
import { notifyRole, notifyUsers } from '../../core/notify.js';
import { emitEvent } from '../../core/events.js';
import { saveAttachment } from '../../core/upload.js';
import { getSetting } from '../../core/settings.js';

const include = {
  lead: true,
  technician: { select: { id: true, name: true, phone: true } },
  reviewedBy: { select: { id: true, name: true } },
};

function ownership(survey, user) {
  if (user.role === 'SURVEY_TECHNICIAN' && survey.technicianId !== user.id) {
    throw forbidden('This survey is not assigned to you.');
  }
}

export async function createSurvey(data, actor) {
  const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
  if (!lead) throw notFound('Enquiry not found.');
  if (['LOST', 'NOT_QUALIFIED'].includes(lead.status)) {
    throw badRequest('This enquiry is closed. Reopen it before scheduling a survey.', 'LEAD_CLOSED');
  }
  const technician = await prisma.user.findUnique({ where: { id: data.technicianId } });
  if (!technician || technician.role !== 'SURVEY_TECHNICIAN') {
    throw badRequest('Choose a survey technician.', 'INVALID_TECHNICIAN');
  }
  const scheduledAt = new Date(data.scheduledAt);
  const windowStart = new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1000);
  const windowEnd = new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000);
  const conflict = await prisma.survey.findFirst({
    where: { technicianId: data.technicianId, status: { in: ['SCHEDULED', 'IN_PROGRESS'] }, scheduledAt: { gte: windowStart, lte: windowEnd } },
  });
  if (conflict) throw badRequest('This technician already has a survey within two hours of that slot.', 'TECHNICIAN_DOUBLE_BOOKED');
  const survey = await prisma.$transaction(async (tx) => {
    const row = await tx.survey.create({
      data: {
        leadId: data.leadId,
        technicianId: data.technicianId,
        scheduledAt,
        notes: data.notes || null,
      },
      include,
    });
    await tx.lead.update({ where: { id: data.leadId }, data: { status: 'SURVEY_SCHEDULED' } });
    await tx.leadActivity.create({
      data: {
        leadId: data.leadId,
        userId: actor.id,
        type: 'STATUS_CHANGE',
        message: `Roof survey scheduled with ${technician.name} on ${new Date(data.scheduledAt).toLocaleString('en-IN')}.`,
      },
    });
    return row;
  });
  await notifyUsers([data.technicianId], {
    title: 'Roof survey assigned',
    body: `${lead.name} · ${lead.address || lead.city || 'Hyderabad'}`,
    link: `/field/surveys/${survey.id}`,
  });
  return survey;
}

export async function listSurveys({ user, status, technicianId, page, pageSize, skip, take }) {
  const where = {};
  if (status) where.status = status;
  if (user.role === 'SURVEY_TECHNICIAN') where.technicianId = user.id;
  else if (technicianId) where.technicianId = technicianId;
  const [items, total] = await Promise.all([
    prisma.survey.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.survey.count({ where }),
  ]);
  return { items, total };
}

export async function getSurvey(id, user) {
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      ...include,
    },
  });
  if (!survey) throw notFound('Survey not found.');
  ownership(survey, user);
  return survey;
}

export async function startSurvey(id, user) {
  const survey = await prisma.survey.findUnique({ where: { id } });
  if (!survey) throw notFound('Survey not found.');
  ownership(survey, user);
  if (survey.status !== 'SCHEDULED') throw badRequest('Only a scheduled survey can be started.', 'INVALID_TRANSITION');
  return prisma.survey.update({
    where: { id },
    data: { status: 'IN_PROGRESS' },
    include,
  });
}

/**
 * Submits the on-site roof report with photos.
 * Flow: verify ownership → write survey fields → store photos as Attachments →
 * move lead to SURVEY_DONE → notify the sales owner.
 */
export async function submitSurvey(id, data, user, files = []) {
  const survey = await prisma.survey.findUnique({ where: { id }, include: { lead: true } });
  if (!survey) throw notFound('Survey not found.');
  ownership(survey, user);
  if (!['SCHEDULED', 'IN_PROGRESS'].includes(survey.status)) {
    throw badRequest('This survey has already been submitted.', 'INVALID_TRANSITION');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.survey.update({
      where: { id },
      data: {
        roofType: data.roofType,
        shadowFreeAreaSqft: data.shadowFreeAreaSqft,
        roofDirection: data.roofDirection,
        tiltDegrees: data.tiltDegrees,
        cableDistanceMeters: data.cableDistanceMeters,
        structureHeightFt: data.structureHeightFt,
        earthingPointAvailable: data.earthingPointAvailable,
        recommendedCapacityKw: data.recommendedCapacityKw,
        recommendedSystemType: data.recommendedSystemType,
        notes: data.notes,
        submittedAt: new Date(),
        status: 'SUBMITTED',
      },
      include,
    });
    await tx.lead.update({ where: { id: survey.leadId }, data: { status: 'SURVEY_DONE' } });
    await tx.leadActivity.create({
      data: {
        leadId: survey.leadId,
        userId: user.id,
        type: 'STATUS_CHANGE',
        message: `Survey submitted — recommends ${data.recommendedCapacityKw} kW ${data.recommendedSystemType?.replace('_', '-').toLowerCase() || ''}.`,
      },
    });
    return row;
  });
  for (const file of files) {
    await saveAttachment({
      entityType: 'SURVEY',
      entityId: id,
      file,
      kind: 'PHOTO',
      uploadedById: user.id,
    });
  }
  await notifyRole('SALES_EXECUTIVE', {
    title: 'Survey ready for approval',
    body: `${survey.lead.name} · ${data.recommendedCapacityKw} kW recommended`,
    link: `/sales/surveys/${id}`,
  });
  emitEvent('survey.submitted', { surveyId: id });
  return updated;
}

export async function reviewSurvey(id, { approve, reason }, user) {
  const survey = await prisma.survey.findUnique({ where: { id }, include: { lead: true } });
  if (!survey) throw notFound('Survey not found.');
  if (survey.status !== 'SUBMITTED') {
    throw badRequest('Only a submitted survey can be reviewed.', 'INVALID_TRANSITION');
  }
  const visitFee = approve ? Number(await getSetting('surveyVisitRate') || 500) : null;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.survey.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectionReason: approve ? null : reason,
        visitFee: visitFee !== null ? visitFee : undefined,
        visitFeePaid: false,
      },
      include,
    });
    await tx.lead.update({
      where: { id: survey.leadId },
      data: { status: approve ? 'SURVEY_APPROVED' : 'SURVEY_REJECTED' },
    });
    await tx.leadActivity.create({
      data: {
        leadId: survey.leadId,
        userId: user.id,
        type: 'STATUS_CHANGE',
        message: approve ? 'Survey approved — ready to quote.' : `Survey rejected — ${reason}`,
      },
    });
    return row;
  });
  await notifyRole('SALES_EXECUTIVE', {
    title: approve ? 'Survey approved' : 'Survey rejected',
    body: `${survey.lead.name}${approve ? ' is ready for a quote.' : `: ${reason}`}`,
    link: `/sales/leads/${survey.leadId}`,
  });
  if (approve) {
    emitEvent('survey.approved', { surveyId: id, leadId: survey.leadId });
    await notifyUsers([survey.technicianId], {
      title: 'Survey approved — visit fee credited',
      body: `Visit fee of ₹${visitFee} for ${survey.lead.name} has been credited to your account.`,
      link: `/field/surveys/${id}`,
    });
  }
  return updated;
}

export async function rescheduleSurvey(id, scheduledAt) {
  return prisma.survey.update({
    where: { id },
    data: { scheduledAt: new Date(scheduledAt), status: 'SCHEDULED' },
    include,
  });
}

/** Returns all approved surveys for a technician with visit fee info. */
export async function getTechnicianEarnings(technicianId, actor) {
  if (actor.role === 'SURVEY_TECHNICIAN' && actor.id !== technicianId) {
    throw forbidden('You can only view your own earnings.');
  }
  const surveys = await prisma.survey.findMany({
    where: { technicianId, status: 'APPROVED', visitFee: { not: null } },
    orderBy: { reviewedAt: 'desc' },
    select: {
      id: true,
      scheduledAt: true,
      reviewedAt: true,
      visitFee: true,
      visitFeePaid: true,
      lead: { select: { name: true, city: true } },
    },
  });
  const totalEarned = surveys.reduce((s, sv) => s + Number(sv.visitFee || 0), 0);
  const totalPaid = surveys.filter((sv) => sv.visitFeePaid).reduce((s, sv) => s + Number(sv.visitFee || 0), 0);
  const totalPending = totalEarned - totalPaid;
  return { surveys, totalEarned, totalPaid, totalPending };
}

/** All unpaid visit fees — for SuperAdmin payout dashboard. */
export async function listUnpaidVisitFees() {
  const surveys = await prisma.survey.findMany({
    where: { status: 'APPROVED', visitFee: { not: null }, visitFeePaid: false },
    orderBy: { reviewedAt: 'asc' },
    select: {
      id: true,
      scheduledAt: true,
      reviewedAt: true,
      visitFee: true,
      technician: { select: { id: true, name: true, phone: true } },
      lead: { select: { name: true, city: true } },
    },
  });
  // Group by technician
  const map = {};
  for (const sv of surveys) {
    const tid = sv.technician.id;
    if (!map[tid]) map[tid] = { technician: sv.technician, surveys: [], total: 0 };
    map[tid].surveys.push(sv);
    map[tid].total += Number(sv.visitFee);
  }
  return Object.values(map);
}

/** SuperAdmin marks a survey's visit fee as paid out. */
export async function markVisitFeePaid(id, actor) {
  const survey = await prisma.survey.findUnique({ where: { id } });
  if (!survey) throw notFound('Survey not found.');
  if (survey.status !== 'APPROVED') throw badRequest('Only approved surveys have visit fees.', 'NOT_APPROVED');
  if (survey.visitFeePaid) throw badRequest('This visit fee is already marked as paid.', 'ALREADY_PAID');
  return prisma.survey.update({
    where: { id },
    data: { visitFeePaid: true },
    include,
  });
}
