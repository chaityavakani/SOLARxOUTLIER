import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created, pageMeta } from '../../core/response.js';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { parsePaging } from '../../core/pagination.js';
import { ROLES, createUser, listTechnicians, listUsers, resetUserPassword, setUserStatus, updateUser } from './users.service.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  '/technicians',
  requireRole('SUPER_ADMIN', 'DIRECTOR', 'SALES_EXECUTIVE', 'WAREHOUSE_MANAGER', 'SUPPORT_EXECUTIVE'),
  asyncHandler(async (req, res) => {
    const type = req.query.type === 'survey' ? 'survey' : 'installation';
    ok(res, await listTechnicians(type));
  })
);

usersRouter.use(requireRole('SUPER_ADMIN'));

usersRouter.get(
  '/',
  validate({
    query: z.object({
      q: z.string().optional(),
      role: z.enum(ROLES).optional(),
      status: z.enum(['active', 'inactive']).optional(),
      page: z.string().optional(),
      pageSize: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const paging = parsePaging(req.query);
    const { items, total } = await listUsers({ ...req.query, ...paging });
    ok(res, items, pageMeta(paging.page, paging.pageSize, total));
  })
);

const userBody = z.object({
  name: z.string().trim().min(2, 'Enter the full name.'),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
  phone: z.string().trim().regex(/^[0-9]{10}$/, 'Enter a 10-digit phone number.').optional().or(z.literal('')),
  role: z.enum(ROLES),
  hourlyRate: z.coerce.number().min(0).max(10000).optional().nullable(),
});

usersRouter.post(
  '/',
  validate({
    body: userBody.extend({
      password: z.string().min(8, 'Password must be at least 8 characters.'),
    }),
  }),
  asyncHandler(async (req, res) => created(res, await createUser(req.body, req.user, req.ip)))
);

usersRouter.patch(
  '/:id',
  validate({ body: userBody.partial() }),
  asyncHandler(async (req, res) => ok(res, await updateUser(req.params.id, req.body, req.user, req.ip)))
);

usersRouter.patch(
  '/:id/status',
  validate({ body: z.object({ isActive: z.boolean() }) }),
  asyncHandler(async (req, res) =>
    ok(res, await setUserStatus(req.params.id, req.body.isActive, req.user, req.ip))
  )
);

usersRouter.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => ok(res, await resetUserPassword(req.params.id, req.user, req.ip)))
);
