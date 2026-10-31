import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
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

export default function Login({ onSuccess, onBack, onSignup }) {
  const [identifier, setIdentifier] = useState('admin@sunpower.in');
  const [password, setPassword] = useState('Demo@1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(identifierValue = identifier) {
    setError('');
    const id = identifierValue.trim();
    if (!id) return setError('Enter your email or phone number.');
    if (!password || password.length < 6) return setError('Enter your password.');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { identifier: id, password });
      onSuccess(data.data.user);
    } catch (loginError) {
      setError(errorText(loginError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <button className="back-button" onClick={onBack}>
          ← Back to website
        </button>
        <div className="auth-brand">
          <img src="/logo.png" alt="Logo" className="site-logo auth-logo" />
        </div>
        <div className="auth-content">
          <p className="eyebrow">CUSTOMER PORTAL</p>
          <h1>Sign in to your workspace.</h1>
          <p className="muted">
            Choose a demo role for one-click login, or use your own customer credentials.
          </p>
          <div className="demo-accounts">
              <div className="demo-heading">
                <strong>Demo accounts</strong>
                <small>Password: Demo@1234</small>
              </div>
              {demoAccounts.map(([accountName, role, email]) => (
                <button
                  className="demo-account"
                  type="button"
                  key={email}
                  disabled={busy}
                  onClick={() => {
                    setIdentifier(email);
                    login(email);
                  }}
                >
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
          <form onSubmit={(event) => { event.preventDefault(); login(); }}>
            <label>
              Email or phone
              <input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
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
      </div>
      <div className="auth-image">
        <div>
          <p className="eyebrow">SOLAR INSTALLATION PLATFORM</p>
          <h2>Good work starts with a good system.</h2>
        </div>
      </div>
    </div>
  );
}
