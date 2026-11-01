import { Router } from 'express';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { forbidden } from '../../core/AppError.js';
import { prisma } from '../../core/prisma.js';

export const customersRouter = Router();
customersRouter.use(requireAuth);

customersRouter.get('/me/requests', asyncHandler(async (req, res) => {
  if (req.user.role !== 'CUSTOMER' || !req.user.customer?.id) {
    throw forbidden('Only customer accounts can view customer requests.');
  }
  const rows = await prisma.lead.findMany({
    where: { customerId: req.user.customer.id },
    include: {
      surveys: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, scheduledAt: true, reviewedAt: true, rejectionReason: true, recommendedCapacityKw: true } },
      quotes: {
        orderBy: { createdAt: 'desc' }, take: 1,
        select: { id: true, number: true, status: true, total: true, validUntil: true, project: { select: { id: true, code: true, status: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, rows);
}));
