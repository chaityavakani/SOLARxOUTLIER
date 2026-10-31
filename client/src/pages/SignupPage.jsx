import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api, errorText } from '../shared/api.js';

export default function SignupPage({ onSuccess, onBack, onLogin }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    addressLine: '',
    city: '',
    state: '',
    pincode: '',
    roofType: '',
    monthlyBill: '',
    systemType: 'NOT_SURE',
    wantsSubsidy: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function set(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Enter your full name.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (!/^[0-9]{10}$/.test(form.phone)) errs.phone = 'Enter a 10-digit mobile number.';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password)) errs.password = 'Include at least one letter.';
    else if (!/[0-9]/.test(form.password)) errs.password = 'Include at least one number.';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    if (!form.city.trim()) errs.city = 'Enter your city.';
    return errs;
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone,
        password: form.password,
        addressLine: [form.addressLine, form.pincode].filter(Boolean).join(', ') || undefined,
        city: form.city.trim(),
      };
      const { data } = await api.post('/auth/register', payload);
      onSuccess(data.data.user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page signup-page">
      <div className="auth-panel signup-panel">
        <button className="back-button" onClick={onBack}>← Back to website</button>
        <div className="auth-brand">
          <img src="/logo.png" alt="Logo" className="site-logo auth-logo" />
        </div>
        <div className="auth-content">
          <p className="eyebrow">GET STARTED</p>
          <h1>Create your solar account.</h1>
          <p className="muted">
            Tell us about yourself and your home — we'll use these details to design the right system for you.
          </p>

          <form onSubmit={submit} noValidate>
            {/* Personal Details */}
            <p className="form-section-label">Personal Details</p>

            <label>
              Full name *
              <input
                required
                placeholder="e.g. Ramesh Patel"
                value={form.name}
                onChange={set('name')}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </label>

            <div className="form-row">
              <label>
                Email address *
                <input
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                />
                {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
              </label>
              <label>
                Mobile number *
                <input
                  required
                  type="tel"
                  placeholder="10-digit number"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                />
                {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
              </label>
            </div>

            {/* Address */}
            <p className="form-section-label">Installation Address</p>

            <label>
              Address line
              <input
                placeholder="Flat / House no., Street, Area"
                value={form.addressLine}
                onChange={set('addressLine')}
              />
            </label>

            <div className="form-row">
              <label>
                City *
                <input required placeholder="e.g. Ahmedabad" value={form.city} onChange={set('city')} />
                {fieldErrors.city && <span className="field-error">{fieldErrors.city}</span>}
              </label>
              <label>
                State
                <input placeholder="e.g. Gujarat" value={form.state} onChange={set('state')} />
              </label>
            </div>

            <label>
              PIN code
              <input
                placeholder="6-digit PIN"
                value={form.pincode}
                onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              />
            </label>

            {/* Solar Preferences */}
            <p className="form-section-label">Solar Preferences</p>

            <div className="form-row">
              <label>
                Roof type
                <select value={form.roofType} onChange={set('roofType')}>
                  <option value="">Not sure</option>
                  <option value="RCC">RCC / Concrete</option>
                  <option value="METAL">Metal sheet</option>
                  <option value="TILE">Tile / Mangalore</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>
                Avg. monthly electricity bill
                <select value={form.monthlyBill} onChange={set('monthlyBill')}>
                  <option value="">Not sure</option>
                  <option value="below_1000">Below ₹1,000</option>
                  <option value="1000_3000">₹1,000 – ₹3,000</option>
                  <option value="3000_6000">₹3,000 – ₹6,000</option>
                  <option value="above_6000">Above ₹6,000</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                System type interest
                <select value={form.systemType} onChange={set('systemType')}>
                  <option value="NOT_SURE">Not sure</option>
                  <option value="ON_GRID">On-grid</option>
                  <option value="OFF_GRID">Off-grid</option>
                </select>
              </label>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={form.wantsSubsidy}
                onChange={(e) => setForm((p) => ({ ...p, wantsSubsidy: e.target.checked }))}
              />
              I'd like guidance on government subsidy paperwork
            </label>

            {/* Password */}
            <p className="form-section-label">Set a Password</p>

            <label>
              Password *
              <div className="password-input-wrap">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 chars, letters + numbers"
                  value={form.password}
                  onChange={set('password')}
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </label>

            <label>
              Confirm password *
              <div className="password-input-wrap">
                <input
                  required
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                />
                <button type="button" className="password-toggle" onClick={() => setShowConfirm((v) => !v)}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && <span className="field-error">{fieldErrors.confirmPassword}</span>}
            </label>

            {error && <p className="error">{error}</p>}

            <button className="button primary full" type="submit" disabled={busy}>
              {busy ? 'Creating account…' : 'Create my account'} {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <button className="text-button auth-switch" type="button" onClick={onLogin}>
            Already have an account? Sign in
          </button>
        </div>
      </div>

      <div className="auth-image signup-image">
        <div>
          <p className="eyebrow">JOIN THOUSANDS OF HAPPY CUSTOMERS</p>
          <h2>Your rooftop solar journey starts here.</h2>
          <ul className="signup-benefits">
            <li>✓ Free site survey by a trained technician</li>
            <li>✓ Transparent bill of materials & pricing</li>
            <li>✓ 25-year panel warranty support</li>
            <li>✓ Track your project from survey to install</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
