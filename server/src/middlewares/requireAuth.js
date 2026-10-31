import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../core/prisma.js';
import { unauthorized } from '../core/AppError.js';

export const COOKIE_NAME = 'sp_token';

/** Resolves the signed-in user if a valid session exists, otherwise returns null. */
export async function getSessionUser(req) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return null;
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      return null;
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { customer: true },
    });
    if (!user || !user.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

/** Loads the signed-in user from the httpOnly JWT cookie. */
export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { customer: true },
    });
    if (!user || !user.isActive) {
      throw unauthorized('This account is not active.', 'ACCOUNT_INACTIVE');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    hourlyRate: user.hourlyRate,
    isActive: user.isActive,
    customerId: user.customer?.id || null,
    lastLoginAt: user.lastLoginAt,
  };
}
