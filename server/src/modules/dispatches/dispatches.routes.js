import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok } from '../../core/response.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { createDispatchForProject, deliverDispatch, dispatchOrder, getDispatch, listDispatches, markPacked, scanSerial } from './dispatches.service.js';

export const dispatchesRouter = Router();
dispatchesRouter.use(requireAuth, requireRole('WAREHOUSE_MANAGER', 'DIRECTOR', 'SUPER_ADMIN'));
dispatchesRouter.get('/', asyncHandler(async (req, res) => ok(res, await listDispatches(req.query.status))));
dispatchesRouter.get('/:id', asyncHandler(async (req, res) => ok(res, await getDispatch(req.params.id))));
dispatchesRouter.post('/from-project/:projectId', asyncHandler(async (req, res) => ok(res, await createDispatchForProject(req.params.projectId))));
dispatchesRouter.post('/:id/scan', validate({ body: z.object({ serialNumber: z.string().trim().min(1) }) }), asyncHandler(async (req, res) => ok(res, await scanSerial(req.params.id, req.body.serialNumber))));
dispatchesRouter.post('/:id/pack', validate({ body: z.object({ lineId: z.string(), quantity: z.coerce.number().int().nonnegative() }) }), asyncHandler(async (req, res) => ok(res, await markPacked(req.params.id, req.body.lineId, req.body.quantity))));
dispatchesRouter.post('/:id/dispatch', validate({ body: z.object({ vehicleNo: z.string().min(1), driverName: z.string().min(2), driverPhone: z.string().regex(/^[0-9]{10}$/) }) }), asyncHandler(async (req, res) => ok(res, await dispatchOrder(req.params.id, req.body, req.user))));
dispatchesRouter.post('/:id/deliver', validate({ body: z.object({ receivedByName: z.string().trim().min(2) }) }), asyncHandler(async (req, res) => ok(res, await deliverDispatch(req.params.id, req.body.receivedByName))));
