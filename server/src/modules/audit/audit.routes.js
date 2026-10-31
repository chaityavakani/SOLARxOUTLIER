import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, pageMeta } from '../../core/response.js';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { prisma } from '../../core/prisma.js';
import { parsePaging } from '../../core/pagination.js';

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'DIRECTOR'));

auditRouter.get(
  '/',
  validate({
    query: z.object({
      userId: z.string().optional(),
      entityType: z.string().optional(),
      action: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      page: z.string().optional(),
      pageSize: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = parsePaging(req.query);
    const where = {};
    if (req.query.userId) where.userId = req.query.userId;
    if (req.query.entityType) where.entityType = req.query.entityType;
    if (req.query.action) where.action = req.query.action;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to);
    }
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);
    ok(res, items, pageMeta(page, pageSize, total));
  })
);
