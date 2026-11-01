import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import {
  listPayments, submitPayment, recordPayment,
  verifyPayment, rejectPayment, listPendingPayments,
} from './payments.service.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const paymentBody = z.object({
  projectId: z.string().min(1),
  amount: z.coerce.number().positive(),
  type: z.enum(['ADVANCE', 'PARTIAL', 'FINAL', 'SERVICE']),
  mode: z.enum(['UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD']),
  reference: z.string().optional(),
  proofNote: z.string().optional(),
});

// Customer submits their payment for verification
paymentsRouter.post(
  '/submit',
  requireRole('CUSTOMER'),
  validate({ body: paymentBody }),
  asyncHandler(async (req, res) => created(res, await submitPayment(req.body, req.user)))
);

// Sales/Admin view all pending payments
paymentsRouter.get(
  '/pending',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  asyncHandler(async (_req, res) => ok(res, await listPendingPayments()))
);

// Sales/Admin mark payment as received/verified
paymentsRouter.post(
  '/:id/verify',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => ok(res, await verifyPayment(req.params.id, req.user)))
);

// Sales/Admin reject a payment
paymentsRouter.post(
  '/:id/reject',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  validate({ body: z.object({ reason: z.string().min(5, 'Provide a reason (min 5 chars).') }) }),
  asyncHandler(async (req, res) => ok(res, await rejectPayment(req.params.id, req.body.reason, req.user)))
);

// Sales/Admin manually record a payment (cash/cheque walk-in)
paymentsRouter.post(
  '/',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  validate({
    body: paymentBody.extend({ receivedAt: z.string().optional() }),
  }),
  asyncHandler(async (req, res) => created(res, await recordPayment(req.body, req.user)))
);

// List payments for a project (staff + customer)
paymentsRouter.get(
  '/:projectId',
  asyncHandler(async (req, res) => ok(res, await listPayments(req.params.projectId, req.user)))
);
