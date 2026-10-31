import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/asyncHandler.js';
import { ok, created } from '../../core/response.js';
import { validate } from '../../middlewares/validate.js';
import { requireAuth, publicUser, getSessionUser } from '../../middlewares/requireAuth.js';
import { loginLimiter } from '../../middlewares/rateLimits.js';
import { badRequest } from '../../core/AppError.js';
import {
  changePassword,
  clearAuthCookie,
  login,
  registerCustomer,
  setAuthCookie,
  requestOtp,
  verifyOtp,
  resetPasswordWithToken,
} from './auth.service.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  loginLimiter,
  validate({
    body: z.object({
      identifier: z.string().trim().min(3, 'Enter your email or phone number.'),
      password: z.string().min(1, 'Enter your password.'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;
    const { token, user } = await login(identifier, password);
    setAuthCookie(res, token);
    ok(res, { user });
  })
);

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  ok(res, { signedOut: true });
});

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await getSessionUser(req);
    ok(res, { user: user ? publicUser(user) : null });
  })
);

authRouter.post(
  '/register',
  loginLimiter,
  validate({
    body: z.object({
      name: z.string().trim().min(2, 'Enter your full name.'),
      phone: z.string().trim().regex(/^[0-9]{10}$/, 'Enter a 10-digit mobile number.'),
      email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters.')
        .regex(/[A-Za-z]/, 'Include at least one letter.')
        .regex(/[0-9]/, 'Include at least one number.'),
      addressLine: z.string().trim().optional(),
      city: z.string().trim().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = await registerCustomer(req.body);
    const { token } = await login(req.body.phone, req.body.password);
    setAuthCookie(res, token);
    created(res, { user });
  })
);

// Step 1 — request OTP (rate-limited; never reveals whether account exists)
authRouter.post(
  '/request-otp',
  loginLimiter,
  validate({
    body: z.object({
      identifier: z.string().trim().min(3, 'Enter your email or phone number.'),
    }),
  }),
  asyncHandler(async (req, res) => {
    await requestOtp(req.body.identifier);
    ok(res, { sent: true });
  })
);

// Step 2 — verify OTP; returns a short-lived reset JWT on success
authRouter.post(
  '/verify-otp',
  loginLimiter,
  validate({
    body: z.object({
      identifier: z.string().trim().min(3),
      otp: z.string().trim().length(6, 'OTP must be 6 digits.').regex(/^\d{6}$/, 'OTP must be 6 digits.'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await verifyOtp(req.body.identifier, req.body.otp);
    ok(res, result);
  })
);

// Step 3 — set new password using the reset JWT from step 2
authRouter.post(
  '/reset-password',
  validate({
    body: z.object({
      resetToken: z.string().min(10),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters.')
        .regex(/[A-Za-z]/, 'Include at least one letter.')
        .regex(/[0-9]/, 'Include at least one number.'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await resetPasswordWithToken(req.body.resetToken, req.body.newPassword);
    ok(res, result);
  })
);

authRouter.post(
  '/change-password',
  requireAuth,
  validate({
    body: z.object({
      currentPassword: z.string().min(1),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters.')
        .regex(/[A-Za-z]/, 'Include at least one letter.')
        .regex(/[0-9]/, 'Include at least one number.'),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (req.body.currentPassword === req.body.newPassword) {
      throw badRequest('Choose a password different from the current one.', 'SAME_PASSWORD');
    }
    const result = await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    ok(res, result);
  })
);
