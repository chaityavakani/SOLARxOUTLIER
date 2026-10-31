import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { createPurchase, generateNextSerials, listAvailableSerialsByProducts, listProducts, listSerials, listWarranties } from './inventory.service.js';

const staffRoles = ['WAREHOUSE_MANAGER', 'DIRECTOR', 'SUPER_ADMIN', 'SUPPORT_EXECUTIVE', 'SALES_EXECUTIVE', 'INSTALLATION_TECHNICIAN'];

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

inventoryRouter.get('/products', requireRole(...staffRoles), asyncHandler(async (req, res) => ok(res, await listProducts(req.query.q))));
inventoryRouter.get(
  '/next-serials',
  requireRole(...staffRoles),
  asyncHandler(async (req, res) => {
    const { productId, quantity } = req.query;
    if (!productId || !quantity) return ok(res, []);
    ok(res, await generateNextSerials(productId, parseInt(quantity, 10)));
  })
);
inventoryRouter.get('/serials', requireRole(...staffRoles), asyncHandler(async (req, res) => ok(res, await listSerials(req.query.q))));
inventoryRouter.get(
  '/available-serials',
  requireRole(...staffRoles),
  asyncHandler(async (req, res) => {
    const ids = req.query.productIds ? req.query.productIds.split(',').filter(Boolean) : [];
    ok(res, await listAvailableSerialsByProducts(ids));
  })
);
inventoryRouter.get(
  '/warranties',
  requireRole(...staffRoles, 'CUSTOMER'),
  asyncHandler(async (req, res) => {
    const customerId = req.user.role === 'CUSTOMER' ? req.user.customerId : (req.query.customerId || null);
    ok(res, await listWarranties(req.query.q, customerId));
  })
);

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
