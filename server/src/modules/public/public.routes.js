import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { validate } from '../../middlewares/validate.js';
import { prisma } from '../../core/prisma.js';
import { enquiryLimiter } from '../../middlewares/rateLimits.js';
import { createLead } from '../leads/leads.service.js';
import { kitMargin } from '../kit-templates/kitTemplates.service.js';
import { getScheduleByToken } from '../reports/reports.service.js';

export const publicRouter = Router();

publicRouter.get(
  '/packages',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.kitTemplate.findMany({
      where: { isActive: true },
      include: { items: { include: { product: true } } },
      orderBy: [{ systemType: 'asc' }, { capacityKw: 'asc' }],
    });
    ok(
      res,
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        systemType: row.systemType,
        capacityKw: row.capacityKw,
        description: row.description,
        price: row.basePrice,
        panelCount: row.items
          .filter((i) => i.product.category === 'PANEL')
          .reduce((s, i) => s + Number(i.quantity), 0),
      }))
    );
  })
);

publicRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [projects, capacity] = await Promise.all([
      prisma.project.count({ where: { status: { in: ['INSTALLED', 'CLOSED'] } } }),
      prisma.project.aggregate({ where: { status: { in: ['INSTALLED', 'CLOSED'] } }, _sum: { capacityKw: true } }),
    ]);
    ok(res, {
      projectsCompleted: projects + 412,
      kwInstalled: Number(capacity._sum.capacityKw || 0) + 1680,
      since: 2014,
    });
  })
);

publicRouter.post(
  '/enquiries',
  enquiryLimiter,
  validate({
    body: z.object({
      name: z.string().trim().min(2, 'Enter your name.'),
      phone: z.string().trim().regex(/^[0-9]{10}$/, 'Enter a 10-digit mobile number.'),
      email: z.string().trim().email().optional().or(z.literal('')),
      address: z.string().optional(),
      city: z.string().optional(),
      pincode: z.string().optional(),
      systemType: z.enum(['ON_GRID', 'OFF_GRID', 'NOT_SURE']).optional(),
      capacityKw: z.coerce.number().positive().optional().nullable(),
      monthlyBillInr: z.coerce.number().min(0).optional().nullable(),
      wantsSubsidy: z.boolean().optional(),
      message: z.string().max(600).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const body = req.body;
    const lead = await createLead(
      {
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address,
        city: body.city,
        pincode: body.pincode,
        source: 'WEB_FORM',
        requestedSystemType: body.systemType,
        requestedCapacityKw: body.capacityKw,
        monthlyBillInr: body.monthlyBillInr,
        wantsSubsidy: body.wantsSubsidy,
        qualificationNotes: body.message,
      },
      null,
      req.ip
    );
    created(res, { code: lead.code });
  })
);

publicRouter.post('/enquire', (req, res, next) => {
  req.url = '/enquiries';
  publicRouter.handle(req, res, next);
});

publicRouter.get(
  '/reports/:token',
  asyncHandler(async (req, res) => ok(res, await getScheduleByToken(req.params.token)))
);
