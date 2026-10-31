import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, pageMeta } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { parsePaging } from '../../core/pagination.js';
import {
  closeProject,
  confirmProject,
  getProject,
  listProjects,
  cancelProject,
  getProjectSubsidy,
  updateProjectSubsidy,
  listAllSubsidies,
} from './projects.service.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const paging = parsePaging(req.query);
    const result = await listProjects({ user: req.user, status: req.query.status, q: req.query.q, ...paging });
    ok(res, result.items, pageMeta(paging.page, paging.pageSize, result.total));
  })
);

// All government subsidy paperwork
projectsRouter.get(
  '/subsidies/all',
  requireRole('DIRECTOR', 'SUPER_ADMIN', 'SALES_EXECUTIVE'),
  asyncHandler(async (req, res) => {
    ok(res, await listAllSubsidies());
  })
);

projectsRouter.get('/:id', asyncHandler(async (req, res) => ok(res, await getProject(req.params.id, req.user))));

// Project subsidy detail and update
projectsRouter.get(
  '/:id/subsidy',
  asyncHandler(async (req, res) => ok(res, await getProjectSubsidy(req.params.id)))
);

projectsRouter.put(
  '/:id/subsidy',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  validate({
    body: z.object({
      scheme: z.string().optional(),
      status: z.enum([
        'NOT_STARTED',
        'DOCUMENTS_PENDING',
        'APPLIED',
        'INSPECTION_DONE',
        'APPROVED',
        'DISBURSED',
        'REJECTED',
      ]),
      applicationRef: z.string().optional(),
      amountExpected: z.coerce.number().nonnegative().optional(),
      amountReceived: z.coerce.number().nonnegative().optional(),
      remarks: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await updateProjectSubsidy(req.params.id, req.body, req.user)))
);

projectsRouter.post(
  '/:id/confirm',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => ok(res, await confirmProject(req.params.id, req.user)))
);

projectsRouter.post(
  '/:id/close',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => ok(res, await closeProject(req.params.id, req.user)))
);

projectsRouter.post(
  '/:id/cancel',
  requireRole('DIRECTOR', 'SUPER_ADMIN'),
  validate({ body: z.object({ reason: z.string().trim().min(3) }) }),
  asyncHandler(async (req, res) => ok(res, await cancelProject(req.params.id, req.body.reason, req.user)))
);
