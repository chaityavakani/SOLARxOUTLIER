import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok } from '../../core/response.js';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { prisma } from '../../core/prisma.js';
import { getSettings } from '../../core/settings.js';
import { logAudit } from '../../core/audit.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => ok(res, await getSettings()))
);

settingsRouter.put(
  '/',
  requireRole('SUPER_ADMIN'),
  validate({
    body: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.any())])),
  }),
  asyncHandler(async (req, res) => {
    const before = await getSettings();
    await prisma.$transaction(
      Object.entries(req.body).map(([key, value]) =>
        prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
      )
    );
    await logAudit({
      userId: req.user.id,
      action: 'SETTINGS_UPDATED',
      entityType: 'Setting',
      entityId: 'global',
      before,
      after: { ...before, ...req.body },
      ip: req.ip,
    });
    ok(res, await getSettings());
  })
);
