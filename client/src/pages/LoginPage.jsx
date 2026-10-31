import React, { useState } from 'react';
import { ArrowRight, Sun } from 'lucide-react';
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

export default function Login({ onSuccess, onBack }) {
  const [identifier, setIdentifier] = useState('admin@sunpower.in');
  const [password, setPassword] = useState('Demo@1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  async function login(identifierValue = identifier) {
    setError(''); setBusy(true);
    try { const { data } = await api.post('/auth/login', { identifier: identifierValue, password }); onSuccess(data.data.user); }
    catch (loginError) { setError(errorText(loginError)); } finally { setBusy(false); }
  }
  async function register(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const { data } = await api.post('/auth/register', { name, phone, password }); onSuccess(data.data.user); }
    catch (registerError) { setError(errorText(registerError)); } finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-panel"><button className="back-button" onClick={onBack}>← Back to website</button><div className="auth-brand"><span className="brand-mark"><Sun size={18} /></span> SunPower Solutions</div><div className="auth-content"><p className="eyebrow">CUSTOMER PORTAL</p><h1>{registering ? 'Create your customer account.' : 'Sign in to your workspace.'}</h1><p className="muted">{registering ? 'Use the same phone number from your enquiry to link your request.' : 'Choose a demo role for one-click login, or use your own customer credentials.'}</p>{!registering && <div className="demo-accounts"><div className="demo-heading"><strong>Demo accounts</strong><small>Password: Demo@1234</small></div>{demoAccounts.map(([accountName, role, email]) => <button className="demo-account" type="button" key={email} disabled={busy} onClick={() => { setIdentifier(email); login(email); }}><span className="avatar">{accountName[0]}</span><span><strong>{accountName}</strong><small>{email}</small></span><span className="demo-role">{role.replaceAll('_', ' ')}</span><ArrowRight size={15} /></button>)}</div>}<form onSubmit={registering ? register : (event) => { event.preventDefault(); login(); }}>{registering && <><label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Phone<input required pattern="[0-9]{10}" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} /></label></>}{!registering && <label>Email or phone<input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></label>}<label>Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="error">{error}</p>}<button className="button primary full" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'} {!busy && <ArrowRight size={17} />}</button></form><button className="text-button auth-switch" type="button" onClick={() => { setRegistering(!registering); setError(''); }}>{registering ? 'Already have an account? Sign in' : 'Customer: create an account'}</button></div></div><div className="auth-image"><div><p className="eyebrow">SUNPOWER SOLUTIONS</p><h2>Good work starts with a good system.</h2></div></div></div>;
}
