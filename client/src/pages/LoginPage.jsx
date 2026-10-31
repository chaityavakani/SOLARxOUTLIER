import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Eye, EyeOff, CheckCircle2, RotateCcw } from 'lucide-react';
import { api, errorText } from '../shared/api.js';

const demoAccounts = [
  ['Platform Admin', 'SUPER_ADMIN', 'admin@sunpower.in'],
  ['Director', 'DIRECTOR', 'director@sunpower.in'],
  ['Sales Executive', 'SALES_EXECUTIVE', 'sales@sunpower.in'],
  ['Survey Technician', 'SURVEY_TECHNICIAN', 'survey@sunpower.in'],
  ['Warehouse Manager', 'WAREHOUSE_MANAGER', 'warehouse@sunpower.in'],
  ['Installation Technician', 'INSTALLATION_TECHNICIAN', 'installation@sunpower.in'],
  ['Support Executive', 'SUPPORT_EXECUTIVE', 'support@sunpower.in'],
];

// ── OTP input — single hidden input drives 6 visual boxes ────────────
function OtpInput({ value, onChange }) {
  const hiddenRef = useRef();
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  function handleChange(e) {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
  }

  function handleKeyDown(e) {
    if (e.key === 'Backspace' && value.length === 0) e.preventDefault();
  }

  return (
    <div
      style={{ position: 'relative', display: 'flex', gap: 10, justifyContent: 'center', margin: '24px 0', cursor: 'text' }}
      onClick={() => hiddenRef.current?.focus()}
    >
      {/* Real input — invisible, captures all keyboard input */}
      <input
        ref={hiddenRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          position: 'absolute', opacity: 0,
          width: '100%', height: '100%', top: 0, left: 0,
          cursor: 'text', zIndex: 1,
        }}
      />
      {/* Visual boxes */}
      {digits.map((d, i) => {
        const active = i === value.length;
        return (
          <div
            key={i}
            onClick={() => hiddenRef.current?.focus()}
            style={{
              width: 48, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, fontFamily: 'monospace', userSelect: 'none',
              border: active ? '2px solid #f59e0b' : d ? '2px solid #f59e0b' : '2px solid #d1cfc8',
              borderRadius: 8,
              background: d ? '#fffbeb' : active ? '#fff8e7' : '#fafaf8',
              boxShadow: active ? '0 0 0 3px rgba(245,158,11,0.2)' : 'none',
              transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
              color: '#1a1a1a', position: 'relative', zIndex: 2, pointerEvents: 'none',
            }}
          >
            {d || (active ? <span style={{ width: 2, height: 28, background: '#f59e0b', animation: 'blink 1s step-start infinite', display: 'inline-block' }} /> : null)}
          </div>
        );
      })}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

function AuthWrap({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-panel">{children}</div>
      <div className="auth-image">
        <div>
          <p className="eyebrow">SOLAR INSTALLATION PLATFORM</p>
          <h2>Good work starts with a good system.</h2>
        </div>
      </div>
    </div>
  );
}

export default function Login({ onSuccess, onBack, onSignup }) {
  const [identifier, setIdentifier] = useState('admin@sunpower.in');
  const [password, setPassword] = useState('Demo@1234');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Forgot password — 3-step OTP flow
  const [view, setView] = useState('login'); // 'login' | 'forgot' | 'otp' | 'reset' | 'done'
  const [fpIdentifier, setFpIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  function startResendCooldown() {
    setResendCooldown(60);
    const t = setInterval(() => setResendCooldown(s => { if (s <= 1) { clearInterval(t); return 0; } return s - 1; }), 1000);
  }

  // ── Login ────────────────────────────────────────────────────────────
  async function login(identifierValue = identifier) {
    setError('');
    const id = identifierValue.trim();
    if (!id) return setError('Enter your email or phone number.');
    if (!password || password.length < 6) return setError('Enter your password.');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { identifier: id, password });
      onSuccess(data.data.user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  // ── Step 1: Request OTP ──────────────────────────────────────────────
  async function handleRequestOtp(e) {
    if (e) e.preventDefault();
    setError('');
    const id = fpIdentifier.trim();
    if (!id) return setError('Enter your email or phone number.');
    setBusy(true);
    try {
      await api.post('/auth/request-otp', { identifier: id });
      setOtp('');
      setView('otp');
      startResendCooldown();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: Verify OTP (manual button submit) ───────────────────────
  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    if (otp.length !== 6) return setError('Enter the complete 6-digit OTP.');
    await submitOtp(otp);
  }

  // Auto-submit when all 6 digits entered
  function handleOtpChange(val) {
    setOtp(val);
    setError('');
    if (val.length === 6) {
      // Pass val directly to avoid stale closure on otp state
      setTimeout(() => submitOtp(val), 300);
    }
  }

  async function submitOtp(otpVal) {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { identifier: fpIdentifier.trim(), otp: otpVal });
      setResetToken(data.data.resetToken);
      setView('reset');
    } catch (err) {
      setError(errorText(err));
      setOtp('');
    } finally {
      setBusy(false);
    }
  }

  // ── Step 3: Set New Password ─────────────────────────────────────────
  async function handleResetSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (!/[A-Za-z]/.test(newPassword)) return setError('Include at least one letter.');
    if (!/[0-9]/.test(newPassword)) return setError('Include at least one number.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { resetToken, newPassword });
      setView('done');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function resetForgotFlow() {
    setView('login'); setFpIdentifier(''); setOtp(''); setResetToken('');
    setNewPassword(''); setConfirmPassword(''); setError('');
  }


  // ── View: Done ───────────────────────────────────────────────────────
  if (view === 'done') return (
    <AuthWrap>
      <div className="auth-brand"><img src="/logo.png" alt="Logo" className="site-logo auth-logo" /></div>
      <div className="auth-content" style={{ textAlign: 'center' }}>
        <CheckCircle2 size={52} style={{ color: '#16a34a', margin: '0 auto 16px' }} />
        <h2 style={{ marginBottom: 8 }}>Password updated!</h2>
        <p className="muted" style={{ marginBottom: 28 }}>
          Your password has been reset successfully. Sign in with your new password.
        </p>
        <button className="button primary full" onClick={() => { setView('login'); setError(''); }}>
          Go to Sign In <ArrowRight size={16} />
        </button>
      </div>
    </AuthWrap>
  );

  // ── View: Reset (set new password) ───────────────────────────────────
  if (view === 'reset') return (
    <AuthWrap>
      <button className="back-button" onClick={() => { setView('otp'); setError(''); }}>← Back</button>
      <div className="auth-brand"><img src="/logo.png" alt="Logo" className="site-logo auth-logo" /></div>
      <div className="auth-content">
        <p className="eyebrow">STEP 3 OF 3</p>
        <h1>Set your new password.</h1>
        <p className="muted">Choose a strong password for your account.</p>
        <form onSubmit={handleResetSubmit}>
          <label>
            New password
            <div className="password-input-wrap">
              <input required type={showNew ? 'text' : 'password'} placeholder="Min. 8 chars, letters + numbers"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <button type="button" className="password-toggle" onClick={() => setShowNew(v => !v)}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label>
            Confirm password
            <div className="password-input-wrap">
              <input required type={showConfirm ? 'text' : 'password'} placeholder="Re-enter new password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <button type="button" className="password-toggle" onClick={() => setShowConfirm(v => !v)}>
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="button primary full" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Set New Password'} {!busy && <ArrowRight size={17} />}
          </button>
        </form>
      </div>
    </AuthWrap>
  );

  // ── View: OTP entry ──────────────────────────────────────────────────
  if (view === 'otp') return (
    <AuthWrap>
      <button className="back-button" onClick={() => { setView('forgot'); setError(''); }}>← Back</button>
      <div className="auth-brand"><img src="/logo.png" alt="Logo" className="site-logo auth-logo" /></div>
      <div className="auth-content">
        <p className="eyebrow">STEP 2 OF 3</p>
        <h1>Enter the OTP.</h1>
        <p className="muted">
          We sent a 6-digit code to <strong>{fpIdentifier}</strong>.
          Enter it below — it expires in 10 minutes.
        </p>
        <form onSubmit={handleVerifyOtp}>
          <OtpInput value={otp} onChange={handleOtpChange} />
          {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}
          <button className="button primary full" type="submit" disabled={busy || otp.length !== 6}>
            {busy ? 'Verifying…' : 'Verify OTP'} {!busy && <ArrowRight size={17} />}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {resendCooldown > 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Resend OTP in {resendCooldown}s</p>
          ) : (
            <button className="text-button" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={handleRequestOtp} disabled={busy}>
              <RotateCcw size={13} /> Resend OTP
            </button>
          )}
        </div>
      </div>
    </AuthWrap>
  );

  // ── View: Forgot (enter email/phone) ─────────────────────────────────
  if (view === 'forgot') return (
    <AuthWrap>
      <button className="back-button" onClick={resetForgotFlow}>← Back to sign in</button>
      <div className="auth-brand"><img src="/logo.png" alt="Logo" className="site-logo auth-logo" /></div>
      <div className="auth-content">
        <p className="eyebrow">STEP 1 OF 3</p>
        <h1>Forgot your password?</h1>
        <p className="muted">
          Enter your registered email or phone. We'll send a one-time password (OTP) to verify it's you.
        </p>
        <form onSubmit={handleRequestOtp}>
          <label>
            Email or phone number
            <input required placeholder="you@example.com or 10-digit number"
              value={fpIdentifier} onChange={(e) => setFpIdentifier(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="button primary full" type="submit" disabled={busy}>
            {busy ? 'Sending OTP…' : 'Send OTP'} {!busy && <ArrowRight size={17} />}
          </button>
        </form>
        <button className="text-button auth-switch" type="button" onClick={resetForgotFlow}>
          Back to sign in
        </button>
      </div>
    </AuthWrap>
  );

  // ── View: Login ──────────────────────────────────────────────────────
  return (
    <AuthWrap>
      <button className="back-button" onClick={onBack}>← Back to website</button>
      <div className="auth-brand"><img src="/logo.png" alt="Logo" className="site-logo auth-logo" /></div>
      <div className="auth-content">
        <p className="eyebrow">CUSTOMER PORTAL</p>
        <h1>Sign in to your workspace.</h1>
        <p className="muted">Choose a demo role for one-click login, or use your own customer credentials.</p>
        <div className="demo-accounts">
          <div className="demo-heading">
            <strong>Demo accounts</strong>
            <small>Password: Demo@1234</small>
          </div>
          {demoAccounts.map(([accountName, role, email]) => (
            <button className="demo-account" type="button" key={email} disabled={busy}
              onClick={() => { setIdentifier(email); setPassword('Demo@1234'); login(email); }}>
              <span className="avatar">{accountName[0]}</span>
              <span>
                <strong>{accountName}</strong>
                <small>{email}</small>
              </span>
              <span className="demo-role">{role.replaceAll('_', ' ')}</span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); login(); }}>
          <label>
            Email or phone
            <input required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </label>
          <label>
            Password
            <div className="password-input-wrap">
              <input required type={showPassword ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 10 }}>
            <button type="button" className="text-button" style={{ fontSize: 13 }}
              onClick={() => { setView('forgot'); setError(''); }}>
              Forgot password?
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="button primary full" disabled={busy}>
            {busy ? 'Please wait…' : 'Sign in'} {!busy && <ArrowRight size={17} />}
          </button>
        </form>
        {onSignup && (
          <button className="text-button auth-switch" type="button" onClick={onSignup}>
            New customer? Create a free account
          </button>
        )}
      </div>
    </AuthWrap>
  );
}
