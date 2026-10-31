import { prisma } from './prisma.js';

const YEAR = () => new Date().getFullYear();

/**
 * Generates the next human-readable code (ENQ-2026-0001, INV-2026-0007...).
 * Must be called inside the same transaction that writes the record, so the
 * counter increment rolls back together with the failed write.
 */
export async function nextCode(prefix, tx = prisma) {
  const key = `${prefix}-${YEAR()}`;
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}-${String(counter.value).padStart(4, '0')}`;
}
