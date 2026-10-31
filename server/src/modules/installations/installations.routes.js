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

installationsRouter.get(
  '/my-earnings',
  requireRole('INSTALLATION_TECHNICIAN', 'SUPER_ADMIN', 'DIRECTOR'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../../core/prisma.js');
    const technicianId = req.user.role === 'INSTALLATION_TECHNICIAN' ? req.user.id : (req.query.technicianId || req.user.id);
    const [timeLogs, payouts, technician] = await Promise.all([
      prisma.timeLog.findMany({
        where: { technicianId, entityType: 'INSTALLATION' },
        orderBy: { startedAt: 'desc' },
        include: { technician: { select: { name: true, hourlyRate: true } } },
      }),
      prisma.payout.findMany({
        where: { technicianId },
        orderBy: { periodStart: 'desc' },
      }),
      prisma.user.findUnique({ where: { id: technicianId }, select: { name: true, hourlyRate: true } }),
    ]);
    ok(res, { timeLogs, payouts, technician });
  })
);
