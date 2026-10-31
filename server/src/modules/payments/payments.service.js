import { prisma } from '../../core/prisma.js';
import { badRequest, forbidden, notFound } from '../../core/AppError.js';
import { emitEvent } from '../../core/events.js';

export async function listPayments(projectId, user) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { customerId: true } });
  if (!project) throw notFound('Project not found.');
  if (user.role === 'CUSTOMER' && project.customerId !== user.customer?.id) throw forbidden('This project belongs to another customer.');
  return prisma.payment.findMany({ where: { projectId }, orderBy: { receivedAt: 'desc' } });
}

/**
 * Records a project payment.
 *
 * Why: payments are the source of truth for BR-05 advance confirmation.
 * Flow: validate project and customer → create payment → emit payment.recorded.
 */
export async function recordPayment(data, actor) {
  const project = await prisma.project.findUnique({ where: { id: data.projectId }, include: { quote: true } });
  if (!project) throw notFound('Project not found.');
  if (Number(data.amount) <= 0) throw badRequest('Payment amount must be greater than zero.', 'INVALID_AMOUNT');
  const payment = await prisma.payment.create({
    data: {
      projectId: project.id,
      customerId: project.customerId,
      amount: data.amount,
      type: data.type,
      mode: data.mode,
      reference: data.reference || null,
      receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
      recordedById: actor.id,
    },
  });
  emitEvent('payment.recorded', { paymentId: payment.id, projectId: project.id });
  return payment;
}
