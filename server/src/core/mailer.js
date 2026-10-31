import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendMail({ to, subject, html, text }) {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.warn('[mailer] SMTP not configured — skipping email to', to);
    return;
  }
  return transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
    text,
  });
}

export async function sendOtpEmail(to, name, otp) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9f9f7;border-radius:12px;">
      <div style="text-align:center;margin-bottom:28px;">
        <h2 style="color:#1a1a1a;margin:0;font-size:22px;">SOLARxOUTLIER</h2>
        <p style="color:#666;font-size:13px;margin:4px 0 0;">Password Reset OTP</p>
      </div>
      <div style="background:#fff;border-radius:8px;padding:28px 24px;border:1px solid #e8e3d8;">
        <p style="color:#333;font-size:15px;margin:0 0 12px;">Hi <strong>${name}</strong>,</p>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
          Use the one-time password below to reset your SOLARxOUTLIER account password.
        </p>
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#1a1a1a;color:#f59e0b;font-size:36px;
                      font-weight:900;letter-spacing:10px;padding:18px 32px;border-radius:10px;
                      font-family:monospace;">
            ${otp}
          </div>
        </div>
        <p style="color:#888;font-size:12px;line-height:1.6;margin:0 0 4px;text-align:center;">
          This OTP expires in <strong>10 minutes</strong> and can only be used once.
        </p>
        <p style="color:#aaa;font-size:12px;text-align:center;margin:0;">
          If you didn't request this, ignore this email — your account is safe.
        </p>
      </div>
      <p style="color:#bbb;font-size:11px;text-align:center;margin:20px 0 0;">
        © SOLARxOUTLIER · Solar Installation Management System
      </p>
    </div>
  `;
  return sendMail({
    to,
    subject: `${otp} — Your SOLARxOUTLIER password reset OTP`,
    html,
    text: `Hi ${name},\n\nYour OTP: ${otp}\n\nExpires in 10 minutes. Do not share this with anyone.`,
  });
}

export async function sendPasswordResetEmail(to, name, resetUrl) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f9f7;border-radius:12px;">
      <div style="text-align:center;margin-bottom:28px;">
        <h2 style="color:#1a1a1a;margin:0;font-size:22px;">SOLARxOUTLIER</h2>
        <p style="color:#666;font-size:13px;margin:4px 0 0;">Password Reset Request</p>
      </div>
      <div style="background:#fff;border-radius:8px;padding:28px 24px;border:1px solid #e8e3d8;">
        <p style="color:#333;font-size:15px;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
          We received a request to reset your SOLARxOUTLIER account password.
          Click the button below to choose a new password.
        </p>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${resetUrl}"
             style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;
                    padding:13px 32px;border-radius:7px;font-weight:700;font-size:15px;">
            Reset My Password
          </a>
        </div>
        <p style="color:#888;font-size:12px;line-height:1.6;margin:0 0 8px;">
          This link expires in <strong>1 hour</strong>. If you didn't request a password reset,
          you can safely ignore this email — your password won't change.
        </p>
        <p style="color:#aaa;font-size:11px;margin:0;word-break:break-all;">
          Or copy this link: ${resetUrl}
        </p>
      </div>
      <p style="color:#bbb;font-size:11px;text-align:center;margin:20px 0 0;">
        © SOLARxOUTLIER · Solar Installation Management System
      </p>
    </div>
  `;
  return sendMail({
    to,
    subject: 'Reset your SOLARxOUTLIER password',
    html,
    text: `Hi ${name},\n\nReset your password here:\n${resetUrl}\n\nThis link expires in 1 hour.`,
  });
}

export async function sendWelcomeEmail(to, name, tempPassword) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f9f7;border-radius:12px;">
      <div style="text-align:center;margin-bottom:28px;">
        <h2 style="color:#1a1a1a;margin:0;font-size:22px;">SOLARxOUTLIER</h2>
        <p style="color:#666;font-size:13px;margin:4px 0 0;">Welcome to your solar portal</p>
      </div>
      <div style="background:#fff;border-radius:8px;padding:28px 24px;border:1px solid #e8e3d8;">
        <p style="color:#333;font-size:15px;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">
          Your SOLARxOUTLIER customer portal account is ready.
          You can track your solar project, view quotations, and check your warranty status.
        </p>
        ${tempPassword ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 16px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:13px;color:#92400e;font-weight:600;">Your temporary password:</p>
          <code style="font-size:18px;color:#1a1a1a;letter-spacing:2px;">${tempPassword}</code>
          <p style="margin:8px 0 0;font-size:12px;color:#b45309;">Please change this after your first login.</p>
        </div>` : ''}
        <p style="color:#555;font-size:14px;margin:0;">
          Sign in at: <a href="${env.CLIENT_URL}" style="color:#f59e0b;">${env.CLIENT_URL}</a>
        </p>
      </div>
      <p style="color:#bbb;font-size:11px;text-align:center;margin:20px 0 0;">
        © SOLARxOUTLIER · Solar Installation Management System
      </p>
    </div>
  `;
  return sendMail({
    to,
    subject: 'Welcome to SOLARxOUTLIER — your portal is ready',
    html,
    text: `Hi ${name},\n\nYour SOLARxOUTLIER portal account is ready.\n${tempPassword ? `Temporary password: ${tempPassword}\n` : ''}Sign in at: ${env.CLIENT_URL}`,
  });
}
