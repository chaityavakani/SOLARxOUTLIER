import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import {
  confirmResolution,
  createTicket,
  getTicket,
  listTickets,
  lookupWarranty,
  resolveTicket,
} from './tickets.service.js';

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

ticketsRouter.get('/', asyncHandler(async (req, res) => ok(res, await listTickets(req.user))));

// Instant warranty & customer lookup for rainy season breakdowns
ticketsRouter.get('/warranty-lookup', asyncHandler(async (req, res) => {
  ok(res, await lookupWarranty(req.query.q));
}));

ticketsRouter.get('/:id', asyncHandler(async (req, res) => ok(res, await getTicket(req.params.id, req.user))));

ticketsRouter.post(
  '/',
  validate({
    body: z.object({
      customerId: z.string().optional(),
      projectId: z.string().optional(),
      serialUnitId: z.string().optional(),
      source: z.enum(['PHONE', 'PORTAL', 'WHATSAPP', 'EMAIL']).optional(),
      category: z.enum([
        'NO_POWER',
        'LOW_GENERATION',
        'INVERTER_FAULT',
        'BATTERY_ISSUE',
        'PHYSICAL_DAMAGE',
        'OTHER',
      ]),
      faultCode: z.string().optional(),
      description: z.string().trim().min(5),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => created(res, await createTicket(req.body, req.user)))
);

ticketsRouter.post(
  '/:id/resolve',
  requireRole('SUPPORT_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  validate({
    body: z.object({
      labourHours: z.coerce.number().nonnegative().optional(),
      parts: z
        .array(
          z.object({
            productId: z.string(),
            quantity: z.coerce.number().int().positive(),
            unitPrice: z.coerce.number().nonnegative(),
            unitCost: z.coerce.number().nonnegative().optional(),
          })
        )
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await resolveTicket(req.params.id, req.body, req.user)))
);

ticketsRouter.post(
  '/:id/confirm',
  requireRole('CUSTOMER', 'SUPPORT_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  validate({ body: z.object({ note: z.string().trim().min(3) }) }),
  asyncHandler(async (req, res) => ok(res, await confirmResolution(req.params.id, req.body.note, req.user)))
);
