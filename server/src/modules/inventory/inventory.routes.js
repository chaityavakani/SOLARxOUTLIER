import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { createPurchase, listProducts, listSerials, listWarranties } from './inventory.service.js';

export const inventoryRouter = Router();
inventoryRouter.use(
  requireAuth,
  requireRole('WAREHOUSE_MANAGER', 'DIRECTOR', 'SUPER_ADMIN', 'SUPPORT_EXECUTIVE', 'SALES_EXECUTIVE')
);

inventoryRouter.get('/products', asyncHandler(async (req, res) => ok(res, await listProducts(req.query.q))));
inventoryRouter.get('/serials', asyncHandler(async (req, res) => ok(res, await listSerials(req.query.q))));
inventoryRouter.get('/warranties', asyncHandler(async (req, res) => ok(res, await listWarranties(req.query.q))));

inventoryRouter.post(
  '/purchases',
  requireRole('WAREHOUSE_MANAGER', 'DIRECTOR', 'SUPER_ADMIN'),
  validate({
    body: z.object({
      supplierId: z.string().optional(),
      supplierName: z.string().optional(),
      invoiceRef: z.string().optional(),
      purchasedAt: z.string().optional(),
      items: z
        .array(
          z.object({
            productId: z.string(),
            quantity: z.coerce.number().int().positive(),
            unitCost: z.coerce.number().nonnegative(),
            serialNumbers: z.array(z.string().trim().min(1)).optional(),
          })
        )
        .min(1),
    }),
  }),
  asyncHandler(async (req, res) => created(res, await createPurchase(req.body, req.user)))
);
