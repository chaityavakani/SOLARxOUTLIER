import { prisma } from './prisma.js';

/** Creates notifications for a set of users. Silently ignores empty lists. */
export async function notifyUsers(userIds, { title, body, link }) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, title, body, link })),
  });
}

/** Creates a notification for every active user with the given role. */
export async function notifyRole(role, payload) {
  const users = await prisma.user.findMany({
    where: { role, isActive: true },
    select: { id: true },
  });
  await notifyUsers(users.map((u) => u.id), payload);
}
