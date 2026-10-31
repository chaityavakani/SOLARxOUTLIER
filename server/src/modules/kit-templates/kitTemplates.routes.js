import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import {
  createKitTemplate,
  duplicateKitTemplate,
  getKitTemplate,
  listKitTemplates,
  replaceKitItems,
  updateKitTemplate,
} from './kitTemplates.service.js';

export const kitTemplatesRouter = Router();
kitTemplatesRouter.use(requireAuth);

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive('Quantity must be greater than zero.'),
  notes: z.string().optional(),
});

kitTemplatesRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'DIRECTOR', 'SALES_EXECUTIVE'),
  asyncHandler(async (_req, res) => ok(res, await listKitTemplates()))
);

kitTemplatesRouter.get(
  '/:id',
  requireRole('SUPER_ADMIN', 'DIRECTOR', 'SALES_EXECUTIVE'),
  asyncHandler(async (req, res) => ok(res, await getKitTemplate(req.params.id)))
);

kitTemplatesRouter.post(
  '/',
  requireRole('SUPER_ADMIN'),
  validate({
    body: z.object({
      name: z.string().trim().min(2, 'Enter a template name.'),
      systemType: z.enum(['ON_GRID', 'OFF_GRID']),
      capacityKw: z.coerce.number().positive(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
      items: z.array(itemSchema).min(1, 'Add at least one product to the kit.'),
    }),
  }),
  asyncHandler(async (req, res) => created(res, await createKitTemplate(req.body)))
);

kitTemplatesRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN'),
  validate({
    body: z.object({
      name: z.string().trim().min(2).optional(),
      systemType: z.enum(['ON_GRID', 'OFF_GRID']).optional(),
      capacityKw: z.coerce.number().positive().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await updateKitTemplate(req.params.id, req.body)))
);

kitTemplatesRouter.put(
  '/:id/items',
  requireRole('SUPER_ADMIN'),
  validate({ body: z.object({ items: z.array(itemSchema).min(1, 'Add at least one product.') }) }),
  asyncHandler(async (req, res) =>
    ok(res, await replaceKitItems(req.params.id, req.body.items))
  )
);

kitTemplatesRouter.post(
  '/:id/duplicate',
  requireRole('SUPER_ADMIN'),
  validate({
    body: z.object({
      name: z.string().trim().min(2).optional(),
      capacityKw: z.coerce.number().positive().optional(),
    }),
  }),
  asyncHandler(async (req, res) =>
    created(res, await duplicateKitTemplate(req.params.id, req.body))
  )
);
