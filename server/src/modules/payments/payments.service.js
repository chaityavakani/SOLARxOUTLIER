import { prisma } from '../../core/prisma.js';
import { badRequest, forbidden, notFound } from '../../core/AppError.js';
import { emitEvent } from '../../core/events.js';

export async function listPayments(projectId, user) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { customerId: true } });
  if (!project) throw notFound('Project not found.');
  if (user.role === 'CUSTOMER' && project.customerId !== user.customer?.id)
    throw forbidden('This project belongs to another customer.');
  return prisma.payment.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      recordedBy: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
    },
  });
}

/** Customer submits a payment — creates PENDING_VERIFICATION record. */
export async function submitPayment(data, actor) {
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw notFound('Project not found.');
  if (project.customerId !== actor.customer?.id)
    throw forbidden('You can only submit payments for your own project.');
  if (Number(data.amount) <= 0)
    throw badRequest('Payment amount must be greater than zero.', 'INVALID_AMOUNT');

  const payment = await prisma.payment.create({
    data: {
      projectId: project.id,
      customerId: project.customerId,
      amount: data.amount,
      type: data.type,
      mode: data.mode,
      reference: data.reference || null,
      proofNote: data.proofNote || null,
      status: 'PENDING_VERIFICATION',
      submittedByCustomer: true,
      recordedById: actor.id,
      receivedAt: new Date(),
    },
  });
  emitEvent('payment.submitted', { paymentId: payment.id, projectId: project.id });
  return payment;
}

/** Sales/Admin manually records a verified payment (walk-in cash, cheque etc.) */
export async function recordPayment(data, actor) {
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw notFound('Project not found.');
  if (Number(data.amount) <= 0)
    throw badRequest('Payment amount must be greater than zero.', 'INVALID_AMOUNT');

  const payment = await prisma.payment.create({
    data: {
      projectId: project.id,
      customerId: project.customerId,
      amount: data.amount,
      type: data.type,
      mode: data.mode,
      reference: data.reference || null,
      status: 'VERIFIED',
      submittedByCustomer: false,
      recordedById: actor.id,
      verifiedById: actor.id,
      verifiedAt: new Date(),
      receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
    },
  });
  emitEvent('payment.recorded', { paymentId: payment.id, projectId: project.id });
  return payment;
}

/** Sales/Admin marks a customer-submitted payment as received/verified. */
export async function verifyPayment(paymentId, actor) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFound('Payment not found.');
  if (payment.status !== 'PENDING_VERIFICATION')
    throw badRequest('This payment has already been processed.', 'ALREADY_PROCESSED');

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'VERIFIED', verifiedById: actor.id, verifiedAt: new Date(), rejectionReason: null },
  });
  emitEvent('payment.verified', { paymentId: updated.id, projectId: updated.projectId });
  return updated;
}

/** Sales/Admin rejects a customer-submitted payment with a reason. */
export async function rejectPayment(paymentId, reason, actor) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFound('Payment not found.');
  if (payment.status !== 'PENDING_VERIFICATION')
    throw badRequest('This payment has already been processed.', 'ALREADY_PROCESSED');
  if (!reason?.trim())
    throw badRequest('Provide a rejection reason for the customer.', 'REASON_REQUIRED');

  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'REJECTED', rejectionReason: reason.trim(), verifiedById: actor.id, verifiedAt: new Date() },
  });
}

/** All PENDING_VERIFICATION payments — for Sales/Admin dashboard. */
export async function listPendingPayments() {
  return prisma.payment.findMany({
    where: { status: 'PENDING_VERIFICATION' },
    orderBy: { createdAt: 'asc' },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      project: { select: { id: true, code: true } },
    },
  });
}
