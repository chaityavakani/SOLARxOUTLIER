import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { getDirectorSummary, createShareReport, getSharedReport } from './reports.service.js';

export const reportsRouter = Router();

// Public share link viewer
reportsRouter.get('/shared/:token', asyncHandler(async (req, res) => {
  ok(res, await getSharedReport(req.params.token));
}));

// Authenticated director & super admin routes
reportsRouter.get(
  '/director-summary',
  requireAuth,
  requireRole('DIRECTOR', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    ok(res, await getDirectorSummary());
  })
);

reportsRouter.post(
  '/share',
  requireAuth,
  requireRole('DIRECTOR', 'SUPER_ADMIN'),
  validate({
    body: z.object({
      expiresInDays: z.coerce.number().int().min(1).max(90).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    created(res, await createShareReport(req.body, req.user));
  })
);

