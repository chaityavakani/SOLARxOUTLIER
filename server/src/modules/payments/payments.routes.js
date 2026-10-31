import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { listPayments, recordPayment } from './payments.service.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.get('/:projectId', asyncHandler(async (req, res) => ok(res, await listPayments(req.params.projectId, req.user))));
paymentsRouter.post(
  '/',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  validate({
    body: z.object({
      projectId: z.string().min(1),
      amount: z.coerce.number().positive(),
      type: z.enum(['ADVANCE', 'PARTIAL', 'FINAL', 'SERVICE']),
      mode: z.enum(['UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD']),
      reference: z.string().optional(),
      receivedAt: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => created(res, await recordPayment(req.body, req.user)))
);
