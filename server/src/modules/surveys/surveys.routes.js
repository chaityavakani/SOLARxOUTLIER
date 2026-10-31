import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created, pageMeta } from '../../core/response.js';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { parsePaging } from '../../core/pagination.js';
import { upload } from '../../core/upload.js';
import {
  createSurvey, getSurvey, listSurveys, rescheduleSurvey, reviewSurvey, startSurvey, submitSurvey,
  getTechnicianEarnings, markVisitFeePaid, listUnpaidVisitFees,
} from './surveys.service.js';

export const surveysRouter = Router();
surveysRouter.use(requireAuth);

surveysRouter.get(
  '/',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SURVEY_TECHNICIAN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const paging = parsePaging(req.query);
    const { items, total } = await listSurveys({
      user: req.user,
      status: req.query.status,
      technicianId: req.query.technicianId,
      ...paging,
    });
    ok(res, items, pageMeta(paging.page, paging.pageSize, total));
  })
);

surveysRouter.post(
  '/',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR'),
  validate({
    body: z.object({
      leadId: z.string().min(1),
      technicianId: z.string().min(1),
      scheduledAt: z.string().min(1, 'Choose a date and time.'),
      notes: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => created(res, await createSurvey(req.body, req.user)))
);

// All unpaid visit fees — SuperAdmin payout queue (must be before /:id)
surveysRouter.get(
  '/unpaid-fees',
  requireRole('SUPER_ADMIN', 'DIRECTOR'),
  asyncHandler(async (_req, res) => ok(res, await listUnpaidVisitFees()))
);

// Technician earnings summary (must be before /:id)
surveysRouter.get(
  '/earnings/:technicianId',
  requireRole('SURVEY_TECHNICIAN', 'SUPER_ADMIN', 'DIRECTOR'),
  asyncHandler(async (req, res) => ok(res, await getTechnicianEarnings(req.params.technicianId, req.user)))
);

surveysRouter.get(
  '/:id',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SURVEY_TECHNICIAN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => ok(res, await getSurvey(req.params.id, req.user)))
);

surveysRouter.post(
  '/:id/start',
  requireRole('SURVEY_TECHNICIAN'),
  asyncHandler(async (req, res) => ok(res, await startSurvey(req.params.id, req.user)))
);

surveysRouter.put(
  '/:id/report',
  requireRole('SURVEY_TECHNICIAN'),
  upload.array('photos', 6),
  validate({
    body: z.object({
      roofType: z.enum(['RCC', 'METAL_SHEET', 'TILED', 'OTHER']),
      shadowFreeAreaSqft: z.coerce.number().min(1, 'Enter shadow-free area.'),
      roofDirection: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
      tiltDegrees: z.coerce.number().min(0).max(45).optional(),
      cableDistanceMeters: z.coerce.number().min(0).optional(),
      structureHeightFt: z.coerce.number().min(0).optional(),
      earthingPointAvailable: z.string().optional().transform((v) => v === 'true' || v === 'yes'),
      recommendedCapacityKw: z.coerce.number().positive('Enter recommended capacity.'),
      recommendedSystemType: z.enum(['ON_GRID', 'OFF_GRID', 'NOT_SURE']),
      notes: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) =>
    ok(res, await submitSurvey(req.params.id, req.body, req.user, req.files || []))
  )
);

surveysRouter.post(
  '/:id/approve',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR'),
  asyncHandler(async (req, res) => ok(res, await reviewSurvey(req.params.id, { approve: true }, req.user)))
);

surveysRouter.post(
  '/:id/reject',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR'),
  validate({ body: z.object({ reason: z.string().trim().min(3, 'Give a reason for rejection.') }) }),
  asyncHandler(async (req, res) =>
    ok(res, await reviewSurvey(req.params.id, { approve: false, reason: req.body.reason }, req.user))
  )
);

surveysRouter.patch(
  '/:id/reschedule',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR'),
  validate({ body: z.object({ scheduledAt: z.string().min(1) }) }),
  asyncHandler(async (req, res) => ok(res, await rescheduleSurvey(req.params.id, req.body.scheduledAt)))
);

// SuperAdmin marks visit fee(s) as paid
surveysRouter.post(
  '/:id/mark-paid',
  requireRole('SUPER_ADMIN', 'DIRECTOR'),
  asyncHandler(async (req, res) => ok(res, await markVisitFeePaid(req.params.id, req.user)))
);
