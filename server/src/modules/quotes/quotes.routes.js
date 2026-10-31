import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created, pageMeta } from '../../core/response.js';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { parsePaging } from '../../core/pagination.js';
import {
  acceptQuote, createQuote, getQuote, listQuotes, rejectQuote, replaceQuoteItems, sendQuote, updateQuote,
} from './quotes.service.js';
import { getSettings } from '../../core/settings.js';
import { startPdf, drawHeader, drawTable, drawTotals, drawFooterNote, money, dateText, amountInWords } from '../../core/pdf.js';

export const quotesRouter = Router();
quotesRouter.use(requireAuth);

quotesRouter.get(
  '/',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN', 'CUSTOMER'),
  asyncHandler(async (req, res) => {
    const paging = parsePaging(req.query);
    const { items, total } = await listQuotes({
      user: req.user,
      status: req.query.status,
      q: req.query.q,
      ...paging,
    });
    ok(res, items, pageMeta(paging.page, paging.pageSize, total));
  })
);

quotesRouter.post(
  '/',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR'),
  validate({ body: z.object({ leadId: z.string().min(1), kitTemplateId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => created(res, await createQuote(req.body, req.user)))
);

quotesRouter.get(
  '/:id',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN', 'CUSTOMER'),
  asyncHandler(async (req, res) => ok(res, await getQuote(req.params.id, req.user)))
);

quotesRouter.patch(
  '/:id',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR'),
  validate({
    body: z.object({
      discount: z.coerce.number().min(0).optional(),
      notes: z.string().optional(),
      validUntil: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await updateQuote(req.params.id, req.body)))
);

quotesRouter.put(
  '/:id/items',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR'),
  validate({
    body: z.object({
      items: z.array(
        z.object({
          productId: z.string().optional().nullable(),
          description: z.string().min(1),
          quantity: z.coerce.number().positive(),
          unitPrice: z.coerce.number().min(0),
          taxPercent: z.coerce.number().min(0).max(100),
        })
      ).min(1),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await replaceQuoteItems(req.params.id, req.body.items)))
);

quotesRouter.post(
  '/:id/send',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR'),
  asyncHandler(async (req, res) => ok(res, await sendQuote(req.params.id, req.user)))
);

quotesRouter.post(
  '/:id/accept',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'CUSTOMER'),
  asyncHandler(async (req, res) => ok(res, await acceptQuote(req.params.id, req.user)))
);

quotesRouter.post(
  '/:id/reject',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'CUSTOMER'),
  validate({ body: z.object({ reason: z.string().optional() }) }),
  asyncHandler(async (req, res) => ok(res, await rejectQuote(req.params.id, req.body.reason, req.user)))
);

quotesRouter.get(
  '/:id/pdf',
  requireRole('SALES_EXECUTIVE', 'DIRECTOR', 'SUPER_ADMIN', 'CUSTOMER'),
  asyncHandler(async (req, res) => {
    const quote = await getQuote(req.params.id, req.user);
    const settings = await getSettings();
    const doc = startPdf(res, `${quote.number}.pdf`);
    drawHeader(doc, settings.company, 'Quotation', [
      ['Quote no.', quote.number],
      ['Date', dateText(quote.createdAt)],
      ['Valid until', dateText(quote.validUntil)],
      ['Customer', quote.customer.name],
      ['Site', `${quote.customer.addressLine || ''} ${quote.customer.city || ''}`],
    ]);
    drawTable(
      doc,
      [
        { label: 'Description', width: 250 },
        { label: 'Qty', width: 50, align: 'right' },
        { label: 'Rate', width: 90, align: 'right' },
        { label: 'Tax %', width: 45, align: 'right' },
        { label: 'Amount', width: 64, align: 'right' },
      ],
      quote.items.map((i) => [
        i.description,
        Number(i.quantity),
        money(i.unitPrice),
        Number(i.taxPercent),
        money(i.lineTotal),
      ])
    );
    drawTotals(doc, [
      ['Subtotal', money(quote.subtotal)],
      ['Discount', `- ${money(quote.discount)}`],
      ['GST', money(quote.taxTotal)],
      ['Total', money(quote.total)],
    ]);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F1B2D').text(`Amount in words: ${amountInWords(quote.total)}`);
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text('Terms: 30% advance on order confirmation. Balance before installation. Prices valid for the period shown above.');
    drawFooterNote(doc, `${settings.company.name} · ${settings.company.phone} · ${settings.company.email}`);
    doc.end();
  })
);
