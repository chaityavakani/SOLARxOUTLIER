import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created, pageMeta } from '../../core/response.js';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { parsePaging } from '../../core/pagination.js';
import {
  addActivity, assignLead, createLead, getLead, listLeads, markLost, qualifyLead, updateLead,
} from './leads.service.js';

export const leadsRouter = Router();
leadsRouter.use(requireAuth, requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'));

const phone = z.string().trim().regex(/^[0-9]{10}$/, 'Enter a 10-digit phone number.');

leadsRouter.get(
  '/',
  validate({
    query: z.object({
      q: z.string().optional(),
      status: z.string().optional(),
      source: z.string().optional(),
      assignedTo: z.string().optional(),
      overdue: z.enum(['true', 'false']).optional(),
      page: z.string().optional(),
      pageSize: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const paging = parsePaging(req.query);
    const { items, total } = await listLeads({ ...req.query, ...paging });
    ok(res, items, pageMeta(paging.page, paging.pageSize, total));
  })
);

leadsRouter.post(
  '/',
  validate({
    body: z.object({
      name: z.string().trim().min(2),
      phone,
      email: z.string().trim().email().optional().or(z.literal('')),
      address: z.string().optional(),
      city: z.string().optional(),
      pincode: z.string().optional(),
      source: z.enum(['WEB_FORM', 'WHATSAPP', 'PHONE_CALL', 'WALK_IN', 'REFERRAL']).default('PHONE_CALL'),
      requestedSystemType: z.enum(['ON_GRID', 'OFF_GRID', 'NOT_SURE']).optional(),
      requestedCapacityKw: z.coerce.number().positive().optional().nullable(),
      wantsSubsidy: z.boolean().optional(),
      monthlyBillInr: z.coerce.number().min(0).optional().nullable(),
      roofAreaSqft: z.coerce.number().min(0).optional().nullable(),
      gridConnectionOk: z.boolean().optional().nullable(),
      sanctionedLoadKw: z.coerce.number().min(0).optional().nullable(),
      qualificationNotes: z.string().optional(),
      assignedToId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => created(res, await createLead(req.body, req.user, req.ip)))
);

leadsRouter.get('/:id', asyncHandler(async (req, res) => ok(res, await getLead(req.params.id))));

leadsRouter.patch(
  '/:id',
  validate({
    body: z.object({
      name: z.string().trim().min(2).optional(),
      email: z.string().trim().email().optional().or(z.literal('')),
      address: z.string().optional(), city: z.string().optional(), pincode: z.string().optional(),
      requestedSystemType: z.enum(['ON_GRID', 'OFF_GRID', 'NOT_SURE']).optional(),
      requestedCapacityKw: z.coerce.number().positive().optional().nullable(),
      wantsSubsidy: z.boolean().optional(),
      monthlyBillInr: z.coerce.number().min(0).optional().nullable(),
      roofAreaSqft: z.coerce.number().min(0).optional().nullable(),
      gridConnectionOk: z.boolean().optional().nullable(),
      sanctionedLoadKw: z.coerce.number().min(0).optional().nullable(),
      qualificationNotes: z.string().optional(),
      source: z.enum(['WEB_FORM', 'WHATSAPP', 'PHONE_CALL', 'WALK_IN', 'REFERRAL']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await updateLead(req.params.id, req.body, req.user, req.ip)))
);

leadsRouter.post(
  '/:id/activities',
  validate({
    body: z.object({
      type: z.enum(['CALL', 'NOTE', 'STATUS_CHANGE', 'WHATSAPP', 'VISIT']),
      message: z.string().trim().min(2, 'Write what happened.'),
    }),
  }),
  asyncHandler(async (req, res) => created(res, await addActivity(req.params.id, req.body, req.user)))
);

leadsRouter.post(
  '/:id/qualify',
  validate({
    body: z.object({
      qualified: z.boolean(),
      notes: z.string().optional(),
      requestedCapacityKw: z.coerce.number().positive().optional().nullable(),
      requestedSystemType: z.enum(['ON_GRID', 'OFF_GRID', 'NOT_SURE']).optional(),
      wantsSubsidy: z.boolean().optional(),
      monthlyBillInr: z.coerce.number().min(0).optional().nullable(),
      roofAreaSqft: z.coerce.number().min(0).optional().nullable(),
      gridConnectionOk: z.boolean().optional().nullable(),
      sanctionedLoadKw: z.coerce.number().min(0).optional().nullable(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await qualifyLead(req.params.id, req.body, req.user)))
);

leadsRouter.post(
  '/:id/assign',
  validate({ body: z.object({ assignedToId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => ok(res, await assignLead(req.params.id, req.body.assignedToId, req.user)))
);

leadsRouter.post(
  '/:id/mark-lost',
  validate({ body: z.object({ reason: z.string().trim().min(3, 'Give a reason.') }) }),
  asyncHandler(async (req, res) => ok(res, await markLost(req.params.id, req.body.reason, req.user)))
);
