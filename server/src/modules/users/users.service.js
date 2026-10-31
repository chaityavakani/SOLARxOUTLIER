import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../../core/prisma.js';
import { badRequest, conflict, notFound } from '../../core/AppError.js';
import { logAudit } from '../../core/audit.js';
import { publicUser } from '../../middlewares/requireAuth.js';

const ROLES = [
  'SUPER_ADMIN', 'DIRECTOR', 'SALES_EXECUTIVE', 'SURVEY_TECHNICIAN',
  'CUSTOMER', 'WAREHOUSE_MANAGER', 'INSTALLATION_TECHNICIAN', 'SUPPORT_EXECUTIVE',
];

export async function listUsers({ q, role, status, page, pageSize, skip, take }) {
  const where = {};
  if (role) where.role = role;
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip,
      take,
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        isActive: true, hourlyRate: true, lastLoginAt: true, createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
}

async function superAdminCount() {
  return prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
}

async function assertNotLastSuperAdmin(userId, nextRole, nextActive, actorId) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound('User not found.');
  const losingAdmin =
    target.role === 'SUPER_ADMIN' &&
    target.isActive &&
    (nextRole !== 'SUPER_ADMIN' || nextActive === false);
  if (!losingAdmin) return;
  const count = await superAdminCount();
  if (count <= 1) {
    throw badRequest(
      'This is the only active Super Admin. Add another one before changing this account.',
      'LAST_SUPER_ADMIN'
    );
  }
  if (userId === actorId) {
    throw badRequest('You cannot remove your own Super Admin access.', 'SELF_DEMOTION');
  }
}

export async function createUser(data, actor, ip) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      role: data.role,
      passwordHash,
      hourlyRate: data.hourlyRate ?? null,
    },
  });
  await logAudit({
    userId: actor.id,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    after: { name: user.name, role: user.role },
    ip,
  });
  return publicUser(user);
}

export async function updateUser(id, data, actor, ip) {
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) throw notFound('User not found.');
  if (data.role) await assertNotLastSuperAdmin(id, data.role, before.isActive, actor.id);
  if (data.email) {
    const dupe = await prisma.user.findFirst({ where: { email: data.email, NOT: { id } } });
    if (dupe) throw conflict('That email is already used by another account.', 'EMAIL_TAKEN');
  }
  if (data.phone) {
    const dupe = await prisma.user.findFirst({ where: { phone: data.phone, NOT: { id } } });
    if (dupe) throw conflict('That phone number is already used by another account.', 'PHONE_TAKEN');
  }
  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email === '' ? null : data.email,
      phone: data.phone === '' ? null : data.phone,
      role: data.role,
      hourlyRate: data.hourlyRate === undefined ? undefined : data.hourlyRate,
    },
  });
  await logAudit({
    userId: actor.id,
    action: data.role && data.role !== before.role ? 'USER_ROLE_CHANGED' : 'USER_UPDATED',
    entityType: 'User',
    entityId: id,
    before: { name: before.name, role: before.role, email: before.email, phone: before.phone },
    after: { name: user.name, role: user.role, email: user.email, phone: user.phone },
    ip,
  });
  return publicUser(user);
}

export async function setUserStatus(id, isActive, actor, ip) {
  if (id === actor.id && !isActive) {
    throw badRequest('You cannot deactivate your own account.', 'SELF_DEACTIVATE');
  }
  await assertNotLastSuperAdmin(id, undefined, isActive, actor.id);
  const user = await prisma.user.update({ where: { id }, data: { isActive } });
  await logAudit({
    userId: actor.id,
    action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entityType: 'User',
    entityId: id,
    after: { isActive },
    ip,
  });
  return publicUser(user);
}

export async function resetUserPassword(id, actor, ip) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound('User not found.');
  const temporaryPassword = `Sun@${crypto.randomBytes(4).toString('hex')}`;
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  await logAudit({
    userId: actor.id,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: id,
    ip,
  });
  return { temporaryPassword };
}

export async function listTechnicians(type) {
  const role = type === 'survey' ? 'SURVEY_TECHNICIAN' : 'INSTALLATION_TECHNICIAN';
  return prisma.user.findMany({
    where: { role, isActive: true },
    select: { id: true, name: true, phone: true, email: true, role: true, hourlyRate: true },
    orderBy: { name: 'asc' },
  });
}

export { ROLES };
