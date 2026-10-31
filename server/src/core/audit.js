import { prisma } from './prisma.js';
import { logger } from './logger.js';

/** Writes an audit trail row. Failures are logged, never thrown to the caller. */
export async function logAudit({ userId, action, entityType, entityId, before, after, ip }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entityType,
        entityId: entityId || null,
        before: before ?? undefined,
        after: after ?? undefined,
        ip: ip || null,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log');
  }
}
