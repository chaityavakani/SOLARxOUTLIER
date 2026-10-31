import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../core/prisma.js';
import { env, isProd } from '../../config/env.js';
import { publicUser } from '../../middlewares/requireAuth.js';
import { AppError, conflict, unauthorized, badRequest } from '../../core/AppError.js';
import { createLead } from '../leads/leads.service.js';
import { sendOtpEmail, sendWelcomeEmail } from '../../core/mailer.js';

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

  const result = await prisma.$transaction(async (tx) => {
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

  // Auto-create an enquiry lead so the Sales Executive sees this signup immediately
  try {
    await createLead(
      {
        name,
        phone,
        email: email || undefined,
        city,
        address: addressLine,
        source: 'WEB_FORM',
        requestedSystemType: 'NOT_SURE',
        wantsSubsidy: false,
      },
      null,
      null,
    );
  } catch (_) {
    // lead creation is best-effort — don't fail the signup if it errors
  }

  return result;
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

const OTP_EXPIRY_MS  = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_TRIES  = 5;

/**
 * Generates a 6-digit OTP, bcrypt-hashes it (invisible in DB),
 * stores the hash + expiry, resets the attempt counter, then emails the OTP.
 * Always returns success — never reveals whether the account exists.
 */
export async function requestOtp(identifier) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
  });
  if (!user || !user.email) return; // silently no-op — prevents user enumeration

  // Cryptographically secure 6-digit OTP
  const otpPlain = String(crypto.randomInt(100000, 999999));
  const otpHash  = await bcrypt.hash(otpPlain, 10);
  const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { otpHash, otpExpiry, otpAttempts: 0 },
  });

  await sendOtpEmail(user.email, user.name, otpPlain);
}

/**
 * Verifies the OTP. On success clears OTP fields and returns a short-lived
 * signed reset-JWT so the client can set a new password in the next step.
 * The OTP itself is never stored in plaintext anywhere.
 */
export async function verifyOtp(identifier, otpPlain) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
  });

  // Generic error — don't leak whether account/OTP exists
  const invalid = () => new AppError(400, 'INVALID_OTP', 'Incorrect OTP. Please try again.');

  if (!user || !user.otpHash || !user.otpExpiry) throw invalid();
  if (new Date() > user.otpExpiry) {
    await prisma.user.update({ where: { id: user.id }, data: { otpHash: null, otpExpiry: null, otpAttempts: 0 } });
    throw new AppError(400, 'OTP_EXPIRED', 'Your OTP has expired. Please request a new one.');
  }
  if (user.otpAttempts >= OTP_MAX_TRIES) {
    await prisma.user.update({ where: { id: user.id }, data: { otpHash: null, otpExpiry: null, otpAttempts: 0 } });
    throw new AppError(400, 'OTP_LOCKED', 'Too many wrong attempts. Please request a new OTP.');
  }

  const match = await bcrypt.compare(otpPlain, user.otpHash);
  if (!match) {
    await prisma.user.update({ where: { id: user.id }, data: { otpAttempts: { increment: 1 } } });
    const remaining = OTP_MAX_TRIES - user.otpAttempts - 1;
    throw new AppError(400, 'INVALID_OTP', `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
  }

  // Clear OTP immediately — single-use
  await prisma.user.update({ where: { id: user.id }, data: { otpHash: null, otpExpiry: null, otpAttempts: 0 } });

  // Issue a 15-minute signed reset JWT — purpose-scoped, not a login token
  const resetToken = jwt.sign(
    { sub: user.id, purpose: 'password_reset' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  return { resetToken };
}

/**
 * Accepts the purpose-scoped reset JWT and sets a new password.
 */
export async function resetPasswordWithToken(resetToken, newPassword) {
  let payload;
  try {
    payload = jwt.verify(resetToken, env.JWT_SECRET);
  } catch {
    throw new AppError(400, 'INVALID_TOKEN', 'Reset session expired. Please start again.');
  }
  if (payload.purpose !== 'password_reset') {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid reset token.');
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: payload.sub }, data: { passwordHash } });
  return { reset: true };
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
  // Send welcome email with temp password if customer has an email
  if (customer.email) {
    sendWelcomeEmail(customer.email, customer.name, tempPassword).catch(() => {});
  }
  return tempPassword;
}
