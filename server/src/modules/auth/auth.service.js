import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../core/prisma.js';
import { env, isProd } from '../../config/env.js';
import { publicUser } from '../../middlewares/requireAuth.js';
import { AppError, conflict, unauthorized } from '../../core/AppError.js';

export const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000;

export function setAuthCookie(res, token) {
  res.cookie('sp_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie('sp_token', { path: '/' });
}

/**
 * Signs in with email or phone and returns the user plus a JWT.
 *
 * Why: one login form serves staff (email) and customers (phone).
 * Flow: find user by email OR phone → bcrypt compare → issue 8h token → record lastLoginAt.
 * Throws: 401 INVALID_CREDENTIALS with a deliberately generic message.
 */
export async function login(identifier, password) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
    include: { customer: true },
  });
  if (!user || !user.isActive) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email/phone or password is incorrect.');
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email/phone or password is incorrect.');
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '8h' });
  return { token, user: publicUser(user) };
}

/**
 * Self sign-up for customers. Links to an existing Customer row by phone
 * instead of duplicating the person when sales already created them.
 */
export async function registerCustomer({ name, phone, email, password, addressLine, city }) {
  const existingUser = await prisma.user.findUnique({ where: { phone } });
  if (existingUser) {
    throw conflict('An account with this phone number already exists. Please sign in.', 'PHONE_TAKEN');
  }
  if (email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw conflict('An account with this email already exists. Please sign in.', 'EMAIL_TAKEN');
    }
  }
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.$transaction(async (tx) => {
    let customer = await tx.customer.findFirst({ where: { phone } });
    if (customer?.userId) {
      throw conflict('This phone number is already linked to a customer account. Please sign in.', 'PHONE_TAKEN');
    }
    if (!customer) {
      customer = await tx.customer.create({
        data: { name, phone, email, addressLine, city },
      });
    }
    const user = await tx.user.create({
      data: { name, phone, email: email || null, passwordHash, role: 'CUSTOMER' },
    });
    await tx.customer.update({ where: { id: customer.id }, data: { userId: user.id } });
    await tx.lead.updateMany({ where: { phone, customerId: null }, data: { customerId: customer.id } });
    const full = await tx.user.findUnique({ where: { id: user.id }, include: { customer: true } });
    return publicUser(full);
  });
}

/**
 * Changes the signed-in user's password after verifying the current one.
 */
export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw unauthorized('Your current password is incorrect.', 'INVALID_PASSWORD');
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { changed: true };
}

/** Creates a working customer login when a quote is first sent. */
export async function ensureCustomerLogin(customer) {
  if (customer.userId) return null;
  const existing = customer.phone ? await prisma.user.findUnique({ where: { phone: customer.phone } }) : null;
  if (existing) {
    await prisma.customer.update({ where: { id: customer.id }, data: { userId: existing.id } });
    return null;
  }
  const tempPassword = 'Demo@1234';
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({
    data: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email || null,
      passwordHash,
      role: 'CUSTOMER',
    },
  });
  await prisma.customer.update({ where: { id: customer.id }, data: { userId: user.id } });
  return tempPassword;
}
