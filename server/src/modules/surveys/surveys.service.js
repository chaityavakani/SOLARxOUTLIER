import { prisma } from '../../core/prisma.js';
import { badRequest, forbidden, notFound } from '../../core/AppError.js';
import { notifyRole, notifyUsers } from '../../core/notify.js';
import { emitEvent } from '../../core/events.js';
import { saveAttachment } from '../../core/upload.js';

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
      orderBy: [{ scheduledAt: 'asc' }],
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
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.survey.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectionReason: approve ? null : reason,
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
  if (approve) emitEvent('survey.approved', { surveyId: id, leadId: survey.leadId });
  return updated;
}

export async function rescheduleSurvey(id, scheduledAt) {
  return prisma.survey.update({
    where: { id },
    data: { scheduledAt: new Date(scheduledAt), status: 'SCHEDULED' },
    include,
  });
}
