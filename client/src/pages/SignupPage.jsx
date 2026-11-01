import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { detectGibberish } from '../shared/gibberish.js';

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
  const [pinLookup, setPinLookup] = useState('idle'); // idle | loading | found | error

  function set(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  // Only letters, spaces, dots, hyphens, apostrophes — no random symbols or numbers
  const NAME_RE   = /^[A-Za-zऀ-ॿ\s.''-]{2,100}$/;
  const PLACE_RE  = /^[A-Za-zऀ-ॿ\s.''-]{2,100}$/;
  const LETTERS_FILTER = /[^A-Za-zऀ-ॿ\s.''-]/g;

  function setFieldError(field, msg) {
    setFieldErrors((prev) => msg ? { ...prev, [field]: msg } : (({ [field]: _, ...rest }) => rest)(prev));
  }

  function handleNameChange(e) {
    const raw = e.target.value;
    const hasInvalid = LETTERS_FILTER.test(raw);
    const v = raw.replace(LETTERS_FILTER, '');
    setForm((p) => ({ ...p, name: v }));
    if (hasInvalid) {
      setFieldError('name', 'Name can only contain letters and spaces — no numbers or special characters.');
    } else if (v.length > 0 && v.trim().length < 2) {
      setFieldError('name', 'Name must be at least 2 characters.');
    } else {
      setFieldError('name', detectGibberish(v, 'Name'));
    }
  }

  function handleCityChange(e) {
    const raw = e.target.value;
    const hasInvalid = LETTERS_FILTER.test(raw);
    const v = raw.replace(LETTERS_FILTER, '');
    setForm((p) => ({ ...p, city: v }));
    if (hasInvalid) {
      setFieldError('city', 'City name can only contain letters — no numbers or symbols.');
    } else {
      setFieldError('city', detectGibberish(v, 'City'));
    }
  }

  function handleStateChange(e) {
    const raw = e.target.value;
    const hasInvalid = LETTERS_FILTER.test(raw);
    const v = raw.replace(LETTERS_FILTER, '');
    setForm((p) => ({ ...p, state: v }));
    if (hasInvalid) {
      setFieldError('state', 'State name can only contain letters — no numbers or symbols.');
    } else {
      setFieldError('state', detectGibberish(v, 'State'));
    }
  }

  async function handlePincodeChange(e) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    setForm((p) => ({ ...p, pincode: v }));
    setFieldErrors((prev) => { const { pincode: _, ...rest } = prev; return rest; });
    if (v.length < 6) { setPinLookup('idle'); return; }
    setPinLookup('loading');
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${v}`);
      const json = await res.json();
      if (json?.[0]?.Status === 'Success' && json[0].PostOffice?.length) {
        const po = json[0].PostOffice[0];
        const city = po.Division || po.District || po.Block || '';
        const state = po.State || '';
        setForm((p) => ({
          ...p,
          city: city,
          state: state,
        }));
        setFieldErrors((prev) => { const { city: _c, state: _s, ...rest } = prev; return rest; });
        setPinLookup('found');
      } else {
        setPinLookup('error');
        setFieldErrors((prev) => ({ ...prev, pincode: 'PIN code not found. Please enter city and state manually.' }));
      }
    } catch {
      setPinLookup('error');
    }
  }

  function handlePhoneChange(e) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm((p) => ({ ...p, phone: v }));
    if (e.target.value !== v && e.target.value.length > 0) {
      setFieldError('phone', 'Mobile number must contain digits only.');
    } else if (v.length > 0 && v.length < 10) {
      setFieldError('phone', `Enter a 10-digit number (${v.length}/10 digits so far).`);
    } else {
      setFieldError('phone', null);
    }
  }

  function handleEmailChange(e) {
    const v = e.target.value;
    setForm((p) => ({ ...p, email: v }));
    if (v.length > 5 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setFieldError('email', 'Enter a valid email address (e.g. you@example.com).');
    } else {
      setFieldError('email', null);
    }
  }

  function validate() {
    const errs = {};
    const name = form.name.trim();
    if (!name || name.length < 2) {
      errs.name = 'Enter your full name (at least 2 characters).';
    } else if (!NAME_RE.test(name)) {
      errs.name = 'Name can only contain letters and spaces — no numbers or special characters.';
    } else {
      const g = detectGibberish(name, 'Name');
      if (g) errs.name = g;
    }

    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!/^[0-9]{10}$/.test(form.phone)) {
      errs.phone = 'Enter a valid 10-digit mobile number.';
    }

    if (!form.addressLine.trim()) errs.addressLine = 'Enter your installation address.';

    const city = form.city.trim();
    if (!city) {
      errs.city = 'Enter your city.';
    } else if (!PLACE_RE.test(city)) {
      errs.city = 'City name can only contain letters — no numbers or symbols.';
    } else {
      const g = detectGibberish(city, 'City');
      if (g) errs.city = g;
    }

    const state = form.state.trim();
    if (!state) {
      errs.state = 'Enter your state.';
    } else if (!PLACE_RE.test(state)) {
      errs.state = 'State name can only contain letters — no numbers or symbols.';
    } else {
      const g = detectGibberish(state, 'State');
      if (g) errs.state = g;
    }

    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password)) errs.password = 'Include at least one letter.';
    else if (!/[0-9]/.test(form.password)) errs.password = 'Include at least one number.';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';

    if (form.pincode && !/^[0-9]{6}$/.test(form.pincode)) errs.pincode = 'PIN code must be exactly 6 digits.';
    if (!form.monthlyBill || Number(form.monthlyBill) < 100) errs.monthlyBill = 'Enter your average monthly electricity bill (min ₹100).';
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
      await api.post('/auth/register', payload);
      const meRes = await api.get('/auth/me');
      onSuccess(meRes.data.data.user);
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
                onChange={handleNameChange}
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
                  onChange={handleEmailChange}
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
                  onChange={handlePhoneChange}
                />
                {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
              </label>
            </div>

            {/* Address */}
            <p className="form-section-label">Installation Address</p>

            <label>
              Address line *
              <input
                required
                placeholder="Flat / House no., Street, Area"
                value={form.addressLine}
                onChange={set('addressLine')}
              />
              {fieldErrors.addressLine && <span className="field-error">{fieldErrors.addressLine}</span>}
            </label>

            <label>
              PIN code *
              <div style={{ position: 'relative' }}>
                <input
                  placeholder="Enter 6-digit PIN — city & state auto-fill"
                  value={form.pincode}
                  onChange={handlePincodeChange}
                  maxLength={6}
                  style={{ paddingRight: 36 }}
                />
                {pinLookup === 'loading' && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, border: '2px solid #e5e7eb', borderTopColor: '#3395FF', borderRadius: '50%', display: 'inline-block', animation: 'pinSpin .7s linear infinite' }} />
                )}
                {pinLookup === 'found' && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#16a34a', fontSize: 16, fontWeight: 700 }}>✓</span>
                )}
              </div>
              {fieldErrors.pincode && <span className="field-error">{fieldErrors.pincode}</span>}
              {pinLookup === 'found' && (
                <span style={{ fontSize: 11, color: '#16a34a', marginTop: 3, display: 'block' }}>
                  ✓ City &amp; state auto-filled from PIN code
                </span>
              )}
            </label>

            <div className="form-row">
              <label>
                City *
                <input
                  required
                  placeholder="e.g. Ahmedabad"
                  value={form.city}
                  onChange={handleCityChange}
                />
                {fieldErrors.city && <span className="field-error">{fieldErrors.city}</span>}
              </label>
              <label>
                State *
                <input
                  required
                  placeholder="e.g. Gujarat"
                  value={form.state}
                  onChange={handleStateChange}
                />
                {fieldErrors.state && <span className="field-error">{fieldErrors.state}</span>}
              </label>
            </div>
            <style>{`@keyframes pinSpin { to { transform: translateY(-50%) rotate(360deg) } }`}</style>

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
