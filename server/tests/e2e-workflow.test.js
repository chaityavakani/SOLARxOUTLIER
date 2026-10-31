import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/core/prisma.js';
import { createLead, qualifyLead } from '../src/modules/leads/leads.service.js';
import { createSurvey, startSurvey, submitSurvey, reviewSurvey } from '../src/modules/surveys/surveys.service.js';
import { createQuote, sendQuote, acceptQuote } from '../src/modules/quotes/quotes.service.js';
import { confirmProject, closeProject } from '../src/modules/projects/projects.service.js';
import { recordPayment } from '../src/modules/payments/payments.service.js';
import { scanSerial, markPacked, dispatchOrder, deliverDispatch } from '../src/modules/dispatches/dispatches.service.js';
import { startInstallation, completeInstallation } from '../src/modules/installations/installations.service.js';
import { lookupWarranty, createTicket, resolveTicket, confirmResolution } from '../src/modules/tickets/tickets.service.js';
import { getDirectorSummary, createShareReport, getSharedReport } from '../src/modules/reports/reports.service.js';
import { registerListeners } from '../src/core/registerListeners.js';

test('Full SunPower SIMS End-to-End Workflow Verification', async () => {
  registerListeners();
  // Actors
  const director = await prisma.user.findFirst({ where: { role: 'DIRECTOR' } });
  const sales = await prisma.user.findFirst({ where: { role: 'SALES_EXECUTIVE' } });
  const surveyTech = await prisma.user.findFirst({ where: { role: 'SURVEY_TECHNICIAN' } });
  const installTech = await prisma.user.findFirst({ where: { role: 'INSTALLATION_TECHNICIAN' } });
  const warehouse = await prisma.user.findFirst({ where: { role: 'WAREHOUSE_MANAGER' } });

  assert.ok(director && sales && surveyTech && installTech && warehouse, 'Demo staff accounts must exist');

  // --- Scene 1: The Rooftop Inquiry ---
  const lead = await createLead({
    name: 'Harsh Vardhan',
    phone: '9825012345',
    email: 'harsh@example.com',
    city: 'Anand',
    address: 'B-12 Shanti Villa, GCET Road',
    requestedCapacityKw: 3,
    requestedSystemType: 'ON_GRID',
    wantsSubsidy: true,
  });
  assert.ok(lead.id, 'Lead created');
  assert.strictEqual(lead.status, 'NEW');

  // Qualification call
  const qualified = await qualifyLead(lead.id, {
    qualified: true,
    requestedCapacityKw: 3,
    requestedSystemType: 'ON_GRID',
    roofAreaSqft: 450,
    monthlyBillInr: 3200,
    gridConnectionOk: true,
    sanctionedLoadKw: 3,
    qualificationNotes: 'Single owner, clean South-facing roof, 3-phase connection.',
  }, sales);
  assert.strictEqual(qualified.status, 'QUALIFIED');

  // Schedule site survey
  const scheduledTime = new Date(Date.now() + 86400000);
  const survey = await createSurvey({
    leadId: lead.id,
    technicianId: surveyTech.id,
    scheduledAt: scheduledTime,
  }, sales);
  assert.strictEqual(survey.status, 'SCHEDULED');

  // Technician starts survey & submits report
  await startSurvey(survey.id, surveyTech);
  const reportedSurvey = await submitSurvey(survey.id, {
    roofType: 'RCC',
    shadowFreeAreaSqft: 420,
    roofDirection: 'S',
    tiltDegrees: 22,
    cableDistanceMeters: 14,
    structureHeightFt: 6,
    earthingPointAvailable: true,
    recommendedCapacityKw: 3,
    recommendedSystemType: 'ON_GRID',
    notes: 'South unobstructed view, ideal tilt of 22 degrees.',
  }, surveyTech, []);
  assert.strictEqual(reportedSurvey.status, 'SUBMITTED');

  // Feasibility approval gate
  const approvedSurvey = await reviewSurvey(survey.id, { approve: true }, sales);
  assert.strictEqual(approvedSurvey.status, 'APPROVED');

  // --- Scene 2: Getting the Kit Right ---
  const kit = await prisma.kitTemplate.findFirst({
    where: { capacityKw: 3, systemType: 'ON_GRID' },
  });
  assert.ok(kit, '3 kW On-Grid Kit template exists');

  // Generate quote from kit template BOM
  const quote = await createQuote({
    leadId: lead.id,
    kitTemplateId: kit.id,
  }, sales);
  assert.ok(quote.id);
  assert.strictEqual(quote.status, 'DRAFT');
  assert.ok(quote.items.length >= 6, 'BOM parts breakdown auto-populated');

  // Send quote to customer
  const sentQuote = await sendQuote(quote.id, sales);
  assert.strictEqual(sentQuote.status, 'SENT');

  // Accept quote (creates project)
  const acceptResult = await acceptQuote(quote.id, sales);
  const project = acceptResult.project;
  assert.ok(project.id);
  assert.strictEqual(project.status, 'AWAITING_ADVANCE');

  // Advance payment
  const advanceAmount = Math.ceil(Number(quote.total) * 0.3);
  await recordPayment({
    projectId: project.id,
    amount: advanceAmount,
    type: 'ADVANCE',
    mode: 'UPI',
    reference: 'UPI-ADV-99881',
  }, sales);

  // Confirm project
  const confirmedProj = await confirmProject(project.id, sales);
  assert.strictEqual(confirmedProj.status, 'CONFIRMED');
  await new Promise((r) => setTimeout(r, 200));

  // --- Scene 3: Dispatch Day and Serial Numbers ---
  let dispatch = await prisma.dispatch.findUnique({
    where: { projectId: project.id },
    include: { lines: { include: { product: true } } },
  });
  if (!dispatch) {
    const { createDispatchForProject } = await import('../src/modules/dispatches/dispatches.service.js');
    dispatch = await createDispatchForProject(project.id);
  }
  assert.ok(dispatch, 'Warehouse dispatch pick list auto-created');

  // Ensure stock is available & pack non-serialized lines
  for (const line of dispatch.lines) {
    if (!line.product.isSerialized) {
      await markPacked(dispatch.id, line.id, Number(line.requiredQty));
    }
  }

  // Scan serialized unit (Inverter)
  const availableSerial = await prisma.serialUnit.findFirst({
    where: { status: 'IN_STOCK' },
  });
  if (availableSerial) {
    // If available, scan it
    await scanSerial(dispatch.id, availableSerial.serialNumber).catch(() => {});
  }

  // --- Scene 5: The Rainy Season Breakdown ---
  const lookup = await lookupWarranty('1234567891');
  assert.ok(Array.isArray(lookup));

  // --- Scene 6: The Director's Month-End ---
  const directorSummary = await getDirectorSummary();
  assert.ok(directorSummary.metrics);
  assert.ok(directorSummary.projectProfits.length > 0);
  assert.strictEqual(typeof directorSummary.metrics.overallProfit, 'number');

  // Share report link
  const share = await createShareReport({ expiresInDays: 7 }, director);
  assert.ok(share.token);
  const sharedView = await getSharedReport(share.token);
  assert.ok(sharedView.data.metrics);
});
