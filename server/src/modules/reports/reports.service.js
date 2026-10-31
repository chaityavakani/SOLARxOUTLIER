import { notFound, badRequest } from '../../core/AppError.js';
import { prisma } from '../../core/prisma.js';
import crypto from 'crypto';

export async function getDirectorSummary() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 1. Projects with financial & operational details
  const projects = await prisma.project.findMany({
    include: {
      customer: true,
      quote: {
        include: {
          items: {
            include: { product: true },
          },
        },
      },
      payments: true,
      installation: {
        include: {
          crew: { include: { technician: true } },
        },
      },
      expenses: true,
      subsidy: true,
      tickets: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate profitability per project
  let totalRevenue = 0;
  let totalCost = 0;
  let profitableCount = 0;
  let lossCount = 0;

  const projectProfits = projects.map((p) => {
    const revenue = Number(p.quote?.total || 0);

    // Hardware / stock purchase cost
    const materialCost = (p.quote?.items || []).reduce((sum, item) => {
      const unitCost = Number(item.product?.costPrice || item.unitPrice * 0.7);
      return sum + unitCost * Number(item.quantity);
    }, 0);

    // Technician labor cost
    let hoursWorked = 0;
    if (p.installation?.startedAt && p.installation?.finishedAt) {
      const diffMs = new Date(p.installation.finishedAt) - new Date(p.installation.startedAt);
      hoursWorked = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    } else if (p.installation?.status === 'COMPLETED') {
      hoursWorked = 8; // standard 1-day crew work
    }
    const crewSize = Math.max(1, p.installation?.crew?.length || 1);
    const hourlyRate = 350; // default tech rate in INR
    const laborCost = hoursWorked * hourlyRate * crewSize;

    // Misc site expenses
    const expensesCost = (p.expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);

    const cost = materialCost + laborCost + expensesCost;
    const netProfit = revenue - cost;
    const marginPercent = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;
    const isProfitable = netProfit >= 0;

    const paid = (p.payments || []).reduce((sum, pay) => sum + Number(pay.amount), 0);
    const balance = Math.max(0, revenue - paid);

    if (revenue > 0) {
      totalRevenue += revenue;
      totalCost += cost;
      if (isProfitable) profitableCount++;
      else lossCount++;
    }

    return {
      id: p.id,
      code: p.code,
      customerName: p.customer.name,
      customerPhone: p.customer.phone,
      capacityKw: Number(p.capacityKw),
      systemType: p.systemType,
      status: p.status,
      revenue,
      materialCost,
      laborCost,
      expensesCost,
      totalCost: cost,
      netProfit,
      marginPercent,
      isProfitable,
      paid,
      balance,
      createdAt: p.createdAt,
      installedAt: p.installedAt,
    };
  });

  // 2. Revenue time breakdown
  const payments = await prisma.payment.findMany({
    orderBy: { receivedAt: 'desc' },
  });

  const revenueToday = payments
    .filter((p) => new Date(p.receivedAt) >= startOfToday)
    .reduce((s, p) => s + Number(p.amount), 0);

  const revenueThisWeek = payments
    .filter((p) => new Date(p.receivedAt) >= startOfWeek)
    .reduce((s, p) => s + Number(p.amount), 0);

  const revenueThisMonth = payments
    .filter((p) => new Date(p.receivedAt) >= startOfMonth)
    .reduce((s, p) => s + Number(p.amount), 0);

  // 3. Unfinished Installations
  const unfinishedStatuses = [
    'AWAITING_ADVANCE',
    'CONFIRMED',
    'PACKING',
    'DISPATCHED',
    'DELIVERED',
    'INSTALLATION_SCHEDULED',
    'INSTALLING',
    'INSTALLED',
  ];
  const unfinishedProjects = projectProfits.filter((p) => unfinishedStatuses.includes(p.status));

  // 4. Cash Flow & Payments
  const advanceCollected = payments
    .filter((p) => p.type === 'ADVANCE')
    .reduce((s, p) => s + Number(p.amount), 0);

  const finalCollected = payments
    .filter((p) => p.type === 'FINAL' || p.type === 'PARTIAL')
    .reduce((s, p) => s + Number(p.amount), 0);

  const totalOutstanding = projectProfits
    .filter((p) => p.status !== 'CLOSED' && p.status !== 'CANCELLED')
    .reduce((s, p) => s + p.balance, 0);

  // 5. Government Subsidy Paperwork tracking
  const subsidies = await prisma.subsidyApplication.findMany({
    include: { project: { include: { customer: true } } },
  });

  const subsidyStatusCounts = {
    NOT_STARTED: 0,
    DOCUMENTS_PENDING: 0,
    APPLIED: 0,
    INSPECTION_DONE: 0,
    APPROVED: 0,
    DISBURSED: 0,
    REJECTED: 0,
  };
  let expectedSubsidyTotal = 0;
  let receivedSubsidyTotal = 0;

  subsidies.forEach((sub) => {
    if (subsidyStatusCounts[sub.status] !== undefined) {
      subsidyStatusCounts[sub.status]++;
    }
    expectedSubsidyTotal += Number(sub.amountExpected || 0);
    receivedSubsidyTotal += Number(sub.amountReceived || 0);
  });

  // Also count subsidy-eligible projects without a formal application yet
  const eligibleProjects = projects.filter((p) => p.subsidyEligible);
  const eligibleWithoutApplication = eligibleProjects.filter((p) => !p.subsidy).length;
  subsidyStatusCounts.NOT_STARTED += eligibleWithoutApplication;

  // 6. Open Repairs / Service Tickets
  const tickets = await prisma.ticket.findMany({
    include: { customer: true, serialUnit: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const openTickets = tickets.filter((t) => !['CLOSED', 'RESOLVED'].includes(t.status));
  const underWarrantyTickets = openTickets.filter((t) => t.isUnderWarranty);
  const chargeableTickets = openTickets.filter((t) => !t.isUnderWarranty);

  // 7. Technicians and payroll
  const technicians = await prisma.user.findMany({
    where: { role: { in: ['INSTALLATION_TECHNICIAN', 'SURVEY_TECHNICIAN'] }, isActive: true },
    include: {
      crewAssignments: {
        include: { job: true },
      },
      surveys: true,
    },
  });

  const technicianStats = technicians.map((tech) => {
    const installCount = tech.crewAssignments.length;
    const surveyCount = tech.surveys.length;
    const estimatedHours = installCount * 8 + surveyCount * 2;
    const hourlyRate = Number(tech.hourlyRate || 350);
    const estimatedPay = estimatedHours * hourlyRate;

    return {
      id: tech.id,
      name: tech.name,
      role: tech.role,
      phone: tech.phone,
      installCount,
      surveyCount,
      estimatedHours,
      hourlyRate,
      estimatedPay,
    };
  });

  const overallProfit = totalRevenue - totalCost;
  const overallMargin = totalRevenue > 0 ? Math.round((overallProfit / totalRevenue) * 100) : 0;

  return {
    generatedAt: now,
    metrics: {
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      totalRevenue,
      totalCost,
      overallProfit,
      overallMargin,
      totalProjects: projects.length,
      unfinishedCount: unfinishedProjects.length,
      profitableCount,
      lossCount,
    },
    cashFlow: {
      advanceCollected,
      finalCollected,
      totalCollected: advanceCollected + finalCollected,
      totalOutstanding,
    },
    subsidies: {
      totalCases: subsidies.length + eligibleWithoutApplication,
      statusCounts: subsidyStatusCounts,
      expectedTotal: expectedSubsidyTotal,
      receivedTotal: receivedSubsidyTotal,
      pendingDisbursement: Math.max(0, expectedSubsidyTotal - receivedSubsidyTotal),
      applications: subsidies.map((s) => ({
        id: s.id,
        projectCode: s.project?.code,
        customerName: s.project?.customer?.name,
        scheme: s.scheme,
        status: s.status,
        applicationRef: s.applicationRef,
        amountExpected: Number(s.amountExpected || 0),
        amountReceived: Number(s.amountReceived || 0),
        updatedAt: s.updatedAt,
      })),
    },
    repairs: {
      totalTickets: tickets.length,
      openCount: openTickets.length,
      underWarrantyCount: underWarrantyTickets.length,
      chargeableCount: chargeableTickets.length,
      openTickets: openTickets.slice(0, 10).map((t) => ({
        id: t.id,
        number: t.number,
        customerName: t.customer?.name,
        category: t.category,
        priority: t.priority,
        status: t.status,
        faultCode: t.faultCode,
        isUnderWarranty: t.isUnderWarranty,
        createdAt: t.createdAt,
      })),
    },
    technicians: technicianStats,
    projectProfits,
    unfinishedProjects,
  };
}

export async function createShareReport({ expiresInDays = 7 }, actor) {
  const summary = await getDirectorSummary();
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000);

  const link = await prisma.shareLink.create({
    data: {
      token,
      type: 'DIRECTOR_REPORT',
      params: summary,
      expiresAt,
      createdById: actor.id,
    },
  });

  return {
    token: link.token,
    url: `/shared-report/${link.token}`,
    expiresAt: link.expiresAt,
  };
}

export async function getSharedReport(token) {
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link) throw notFound('Report link not found or invalid.');
  if (new Date(link.expiresAt) < new Date()) {
    throw badRequest('This report link has expired.');
  }
  return {
    expiresAt: link.expiresAt,
    data: link.params,
  };
}

export async function getScheduleByToken(token) {
  const result = await getSharedReport(token);
  return result.data;
}
