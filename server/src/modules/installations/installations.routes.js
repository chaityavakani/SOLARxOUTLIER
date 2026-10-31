import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { completeInstallation, listInstallationJobs, startInstallation } from './installations.service.js';

export const installationsRouter = Router();
installationsRouter.use(requireAuth);
installationsRouter.get('/', requireRole('INSTALLATION_TECHNICIAN', 'WAREHOUSE_MANAGER', 'DIRECTOR', 'SUPER_ADMIN'), asyncHandler(async (req, res) => ok(res, await listInstallationJobs(req.user))));
installationsRouter.post('/:id/start', requireRole('INSTALLATION_TECHNICIAN'), asyncHandler(async (req, res) => ok(res, await startInstallation(req.params.id, req.user))));
installationsRouter.post('/:id/complete', requireRole('INSTALLATION_TECHNICIAN'), validate({ body: z.object({ confirmedCapacityKw: z.coerce.number().positive(), generationTestKw: z.coerce.number().nonnegative(), checklist: z.record(z.boolean()), photoUrls: z.array(z.string()).min(3), signatureDataUrl: z.string().min(20), signedByName: z.string().min(2), remarks: z.string().optional() }) }), asyncHandler(async (req, res) => ok(res, await completeInstallation(req.params.id, req.body, req.user))));
