import { Router } from 'express';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { prisma } from '../../core/prisma.js';
import { notFound } from '../../core/AppError.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = { userId: req.user.id };
    if (req.query.filter === 'unread') where.isRead = false;
    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    ok(res, items);
  })
);

notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
    ok(res, { count });
  })
);

notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
    ok(res, { updated: true });
  })
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const note = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!note) throw notFound('Notification not found.');
    ok(res, await prisma.notification.update({ where: { id: note.id }, data: { isRead: true } }));
  })
);
