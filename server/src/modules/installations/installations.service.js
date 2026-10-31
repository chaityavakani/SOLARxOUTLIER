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
  const rows = await prisma.installationJob.findMany({ where: user.role === 'INSTALLATION_TECHNICIAN' ? { crew: { some: { technicianId: user.id } } } : undefined, include, orderBy: { scheduledDate: 'asc' } });
  return rows;
}

export async function startInstallation(id, user) {
  const job = await prisma.installationJob.findUnique({ where: { id }, include });
  if (!job) throw notFound('Installation job not found.');
  assertCrew(job, user);
  if (!['UNSCHEDULED', 'SCHEDULED'].includes(job.status)) throw badRequest('This job cannot be started.', 'INVALID_TRANSITION');
  const updated = await prisma.installationJob.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: new Date() }, include });
  await prisma.project.update({ where: { id: job.projectId }, data: { status: 'INSTALLING' } });
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
    return row;
  });
  emitEvent('installation.completed', { installationId: id, projectId: job.projectId });
  return updated;
}
