import { prisma } from '../../core/prisma.js';
import { badRequest, forbidden, notFound } from '../../core/AppError.js';
import { emitEvent } from '../../core/events.js';
import { saveDataUrl } from '../../core/upload.js';

const include = {
  project: { include: { customer: true, quote: true, serialUnits: { include: { product: true } } } },
  crew: { include: { technician: true } },
};

function assertCrew(job, user) {
  if (user.role === 'INSTALLATION_TECHNICIAN' && !job.crew.some((member) => member.technicianId === user.id)) {
    throw forbidden('This installation job is not assigned to you.');
  }
}

export async function listInstallationJobs(user) {
  if (user.role === 'INSTALLATION_TECHNICIAN') {
    const unassigned = await prisma.installationJob.findMany({
      where: { crew: { none: {} } },
      select: { id: true },
    });
    if (unassigned.length) {
      await prisma.installationCrew.createMany({
        data: unassigned.map((job) => ({ jobId: job.id, technicianId: user.id, isLead: true })),
        skipDuplicates: true,
      });
    }
  }
  const rows = await prisma.installationJob.findMany({ where: user.role === 'INSTALLATION_TECHNICIAN' ? { crew: { some: { technicianId: user.id } } } : undefined, include, orderBy: { createdAt: 'desc' } });
  return rows;
}

export async function startInstallation(id, user) {
  const job = await prisma.installationJob.findUnique({ where: { id }, include });
  if (!job) throw notFound('Installation job not found.');
  assertCrew(job, user);
  if (!['UNSCHEDULED', 'SCHEDULED'].includes(job.status)) throw badRequest('This job cannot be started.', 'INVALID_TRANSITION');
  const startedAt = new Date();
  const updated = await prisma.installationJob.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt }, include });
  await prisma.project.update({ where: { id: job.projectId }, data: { status: 'INSTALLING' } });
  // Start time log for every crew member
  for (const member of job.crew) {
    await prisma.timeLog.create({
      data: { technicianId: member.technicianId, entityType: 'INSTALLATION', entityId: id, startedAt },
    });
  }
  return updated;
}

export async function completeInstallation(id, data, user) {
  const job = await prisma.installationJob.findUnique({ where: { id }, include });
  if (!job) throw notFound('Installation job not found.');
  assertCrew(job, user);
  if (job.status !== 'IN_PROGRESS') throw badRequest('Start the installation before completing it.', 'INVALID_TRANSITION');
  if (!data.signatureDataUrl) throw badRequest('Customer signature is required.', 'SIGNATURE_REQUIRED');
  if (!Array.isArray(data.photoUrls) || data.photoUrls.length < 3) throw badRequest('At least three completion photos are required.', 'PHOTOS_REQUIRED');
  const signatureUrl = await saveDataUrl(data.signatureDataUrl, 'installation-signature');
  const finishedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.installationJob.update({
      where: { id },
      data: { status: 'COMPLETED', finishedAt, confirmedCapacityKw: data.confirmedCapacityKw, generationTestKw: data.generationTestKw, checklist: data.checklist, customerSignatureUrl: signatureUrl, signedByName: data.signedByName, signedAt: finishedAt, remarks: data.remarks },
      include,
    });
    await tx.project.update({ where: { id: job.projectId }, data: { status: 'INSTALLED', installedAt: finishedAt } });

    // Close time logs and create payout drafts for each crew member
    for (const member of job.crew) {
      const timeLog = await tx.timeLog.findFirst({
        where: { technicianId: member.technicianId, entityType: 'INSTALLATION', entityId: id, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (timeLog) {
        const minutes = Math.round((finishedAt - new Date(timeLog.startedAt)) / 60000);
        await tx.timeLog.update({ where: { id: timeLog.id }, data: { endedAt: finishedAt, minutes } });

        const technician = await tx.user.findUnique({ where: { id: member.technicianId } });
        const rate = Number(technician?.hourlyRate || 0);
        const amount = parseFloat(((minutes / 60) * rate).toFixed(2));

        if (rate > 0) {
          const periodStart = new Date(timeLog.startedAt);
          periodStart.setHours(0, 0, 0, 0);
          const periodEnd = new Date(finishedAt);
          periodEnd.setHours(23, 59, 59, 999);
          await tx.payout.upsert({
            where: { technicianId_periodStart_periodEnd: { technicianId: member.technicianId, periodStart, periodEnd } },
            create: { technicianId: member.technicianId, periodStart, periodEnd, totalMinutes: minutes, hourlyRate: rate, incentive: 0, amount },
            update: { totalMinutes: { increment: minutes }, amount: { increment: amount } },
          });
        }
      }
    }
    return row;
  });
  emitEvent('installation.completed', { installationId: id, projectId: job.projectId });
  return updated;
}
