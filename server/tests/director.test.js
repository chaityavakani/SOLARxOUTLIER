import test from 'node:test';
import assert from 'node:assert/strict';
import { getDirectorSummary, createShareReport, getSharedReport } from '../src/modules/reports/reports.service.js';
import { lookupWarranty } from '../src/modules/tickets/tickets.service.js';
import { prisma } from '../src/core/prisma.js';

test('director summary returns financial and operational metrics', async () => {
  const summary = await getDirectorSummary();
  assert.ok(summary);
  assert.ok(summary.metrics);
  assert.strictEqual(typeof summary.metrics.revenueToday, 'number');
  assert.strictEqual(typeof summary.metrics.totalRevenue, 'number');
  assert.ok(Array.isArray(summary.projectProfits));
  assert.ok(summary.subsidies);
  assert.ok(summary.cashFlow);
  assert.ok(summary.repairs);
});

test('warranty lookup returns matching serial units and coverage status', async () => {
  // Query with existing serial or name
  const results = await lookupWarranty('1234567891');
  assert.ok(Array.isArray(results));
  if (results.length > 0) {
    const item = results[0];
    assert.ok(item.serialNumber);
    assert.ok(item.billingPolicy);
    assert.ok(['WARRANTY_COVERED', 'BILLABLE'].includes(item.billingPolicy.coverage));
  }
});

test('share link generation and retrieval', async () => {
  const admin = await prisma.user.findFirst({ where: { role: 'DIRECTOR' } });
  if (admin) {
    const share = await createShareReport({ expiresInDays: 7 }, admin);
    assert.ok(share.token);
    assert.ok(share.url);

    const retrieved = await getSharedReport(share.token);
    assert.ok(retrieved.data);
    assert.ok(retrieved.data.metrics);
  }
});

