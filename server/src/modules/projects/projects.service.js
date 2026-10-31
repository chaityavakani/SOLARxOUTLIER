import { prisma } from '../../core/prisma.js';
import { conflict, forbidden, notFound } from '../../core/AppError.js';
import { nextCode } from '../../core/codes.js';
import { emitEvent } from '../../core/events.js';
import { getSetting } from '../../core/settings.js';

/** Creates the project row for an accepted quote. Runs inside a transaction. */
export async function createProjectFromQuoteTx(tx, quote, actorId) {
  const existing = await tx.project.findUnique({ where: { quoteId: quote.id } });
  if (existing) return existing;
  const code = await nextCode('PRJ', tx);
  return tx.project.create({
    data: {
      code,
      customerId: quote.customerId,
      quoteId: quote.id,
      status: 'AWAITING_ADVANCE',
      systemType: quote.systemType,
      capacityKw: quote.capacityKw,
      siteAddress: quote.customer?.addressLine || null,
      subsidyEligible: Boolean(quote.lead?.wantsSubsidy),
    },
  });
}

export async function listProjects({ user, status, q, page, pageSize, skip, take }) {
  const where = {};
  if (status) where.status = status;
  if (user.role === 'CUSTOMER') where.customerId = user.customer?.id || '__none__';
  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, city: true } },
        quote: { select: { id: true, number: true, total: true } },
        installation: { select: { id: true, status: true, scheduledDate: true } },
        dispatch: { select: { id: true, status: true, number: true } },
        subsidy: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.project.count({ where }),
  ]);
  return { items, total };
}

export async function getProject(id, user) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: true,
      quote: { include: { items: { include: { product: true } } } },
      payments: { orderBy: { receivedAt: 'desc' } },
      dispatch: { include: { lines: { include: { product: true } } } },
      serialUnits: { include: { product: true, warranty: true } },
      installation: { include: { crew: { include: { technician: true } } } },
      invoices: { include: { lines: true }, orderBy: { createdAt: 'desc' } },
      warranties: { include: { serialUnit: { include: { product: true } } } },
      subsidy: true,
      tickets: { orderBy: { createdAt: 'desc' } },
      expenses: { orderBy: { spentAt: 'desc' } },
    },
  });
  if (!project) throw notFound('Project not found.');
  if (user.role === 'CUSTOMER' && project.customerId !== user.customer?.id) {
    throw forbidden('This project belongs to another customer.');
  }

  const timeline = [
    { at: project.createdAt, label: 'Project created', detail: project.code },
    project.confirmedAt && { at: project.confirmedAt, label: 'Order confirmed', detail: 'Advance received' },
    project.dispatch?.dispatchedAt && {
      at: project.dispatch.dispatchedAt, label: 'Dispatched', detail: project.dispatch.vehicleNo || '',
    },
    project.deliveredAt && { at: project.deliveredAt, label: 'Delivered on site', detail: project.dispatch?.receivedByName || '' },
    project.installation?.scheduledDate && {
      at: project.installation.scheduledDate, label: 'Installation scheduled', detail: '',
    },
    project.installedAt && { at: project.installedAt, label: 'Installation completed', detail: '' },
    project.closedAt && { at: project.closedAt, label: 'Project closed', detail: '' },
  ].filter(Boolean);

  return { ...project, timeline };
}

/**
 * Confirms the order once the advance threshold is met (BR-05).
 * Side effects (pick list, installation job, proforma invoice) run through
 * listeners after this transaction commits.
 */
export async function confirmProject(id, actor) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { quote: true, payments: true, customer: true },
  });
  if (!project) throw notFound('Project not found.');
  if (project.status !== 'AWAITING_ADVANCE') {
    throw conflict('This project is already confirmed or cancelled.', 'ALREADY_CONFIRMED');
  }
  const advancePercent = Number(await getSetting('advancePercent')) || 30;
  const paid = project.payments.reduce((s, p) => s + Number(p.amount), 0);
  const required = (Number(project.quote.total) * advancePercent) / 100;
  if (paid + 0.001 < required) {
    throw conflict(
      `Advance short by ₹${Math.ceil(required - paid).toLocaleString('en-IN')}. At least ${advancePercent}% (₹${Math.ceil(required).toLocaleString('en-IN')}) is required.`,
      'ADVANCE_NOT_RECEIVED',
      { paid, required, advancePercent }
    );
  }
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.project.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
    const lead = await tx.quote.findUnique({ where: { id: project.quoteId } });
    if (lead) {
      await tx.lead.update({ where: { id: lead.leadId }, data: { status: 'WON' } }).catch(() => {});
      await tx.leadActivity.create({
        data: {
          leadId: lead.leadId,
          userId: actor.id,
          type: 'STATUS_CHANGE',
          message: `Order confirmed — ${project.code}. Dispatch pick list and installation job created.`,
        },
      }).catch(() => {});
    }
    return row;
  });
  emitEvent('project.confirmed', { projectId: id });
  return updated;
}

export async function closeProject(id, actor) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { quote: true, payments: true },
  });
  if (!project) throw notFound('Project not found.');
  if (project.status !== 'INSTALLED') {
    throw conflict('The project can be closed only after installation is completed.', 'INSTALLATION_REQUIRED');
  }
  const paid = project.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = Number(project.quote.total) - paid;
  if (balance > 0.001) {
    throw conflict(
      `Final payment of ₹${Math.ceil(balance).toLocaleString('en-IN')} is still pending.`,
      'FINAL_PAYMENT_REQUIRED',
      { paid, total: Number(project.quote.total), balance },
    );
  }
  return prisma.project.update({
    where: { id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
}

export async function cancelProject(id, reason, actor) {
  const project = await prisma.project.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'PROJECT_CANCELLED',
      entityType: 'Project',
      entityId: id,
      after: { reason },
    },
  });
  return project;
}

export async function getProjectSubsidy(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { subsidy: true, customer: true, quote: true },
  });
  if (!project) throw notFound('Project not found.');
  return project.subsidy || {
    projectId,
    scheme: 'PM Surya Ghar Muft Bijli Yojana',
    status: 'NOT_STARTED',
    amountExpected: Math.min(78000, Number(project.capacityKw) * 18000),
    amountReceived: 0,
  };
}

export async function updateProjectSubsidy(projectId, data, actor) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound('Project not found.');

  const now = new Date();
  const updateData = {
    scheme: data.scheme || 'PM Surya Ghar Muft Bijli Yojana',
    status: data.status,
    applicationRef: data.applicationRef,
    amountExpected: data.amountExpected !== undefined ? Number(data.amountExpected) : undefined,
    amountReceived: data.amountReceived !== undefined ? Number(data.amountReceived) : undefined,
    remarks: data.remarks,
  };

  if (data.status === 'APPLIED' && !data.appliedAt) updateData.appliedAt = now;
  if (data.status === 'INSPECTION_DONE' && !data.inspectionAt) updateData.inspectionAt = now;
  if (data.status === 'APPROVED' && !data.approvedAt) updateData.approvedAt = now;
  if (data.status === 'DISBURSED' && !data.disbursedAt) updateData.disbursedAt = now;

  const subsidy = await prisma.subsidyApplication.upsert({
    where: { projectId },
    update: updateData,
    create: {
      projectId,
      scheme: data.scheme || 'PM Surya Ghar Muft Bijli Yojana',
      status: data.status || 'NOT_STARTED',
      applicationRef: data.applicationRef,
      amountExpected: data.amountExpected !== undefined ? Number(data.amountExpected) : Math.min(78000, Number(project.capacityKw) * 18000),
      amountReceived: data.amountReceived !== undefined ? Number(data.amountReceived) : 0,
      remarks: data.remarks,
      appliedAt: data.status === 'APPLIED' ? now : undefined,
    },
    include: { project: { include: { customer: true } } },
  });

  return subsidy;
}

export async function listAllSubsidies() {
  return prisma.subsidyApplication.findMany({
    include: {
      project: {
        include: {
          customer: true,
          quote: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}
