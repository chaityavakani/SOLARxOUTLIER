import { Router } from 'express';
import { z } from 'zod';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { badRequest } from '../../core/AppError.js';
import {
  listPayments, submitPayment, recordPayment,
  verifyPayment, rejectPayment, listPendingPayments,
} from './payments.service.js';

const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const paymentBody = z.object({
  projectId: z.string().min(1),
  amount: z.coerce.number().positive(),
  type: z.enum(['ADVANCE', 'PARTIAL', 'FINAL', 'SERVICE']),
  mode: z.enum(['UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD', 'RAZORPAY']),
  reference: z.string().optional(),
  proofNote: z.string().optional(),
});

// Razorpay: create order
paymentsRouter.post(
  '/razorpay/create-order',
  requireRole('CUSTOMER'),
  validate({ body: z.object({ amount: z.coerce.number().positive(), projectId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { amount, projectId } = req.body;
    const order = await rzp.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `proj_${projectId.slice(-8)}_${Date.now()}`,
      notes: { projectId, customerId: req.user.customerId || req.user.id },
    });
    ok(res, { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  })
);

// Razorpay: verify signature + record payment
paymentsRouter.post(
  '/razorpay/verify',
  requireRole('CUSTOMER'),
  validate({
    body: z.object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
      projectId: z.string(),
      amount: z.coerce.number().positive(),
      type: z.enum(['ADVANCE', 'PARTIAL', 'FINAL', 'SERVICE']),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, projectId, amount, type } = req.body;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) throw badRequest('Payment signature verification failed.', 'INVALID_SIGNATURE');
    const payment = await submitPayment(
      { projectId, amount, type, mode: 'RAZORPAY', reference: razorpay_payment_id, proofNote: `Razorpay Order: ${razorpay_order_id}` },
      req.user,
    );
    ok(res, payment);
  })
);

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
