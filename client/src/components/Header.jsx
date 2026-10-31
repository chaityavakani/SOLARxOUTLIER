import React, { useState, useRef, useEffect } from 'react';
import { Menu, Shield, Lock, LogOut, ChevronDown, Eye, EyeOff, CheckCircle2, X, Mail, Phone, Clock, IndianRupee, Hash, BadgeCheck, CalendarDays } from 'lucide-react';
import { api, errorText } from '../shared/api.js';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  DIRECTOR: 'Director',
  SALES_EXECUTIVE: 'Sales Executive',
  SURVEY_TECHNICIAN: 'Survey Technician',
  WAREHOUSE_MANAGER: 'Warehouse Manager',
  INSTALLATION_TECHNICIAN: 'Installation Technician',
  SUPPORT_EXECUTIVE: 'Support Executive',
  CUSTOMER: 'Customer',
};

// ── Change-Password modal ────────────────────────────────────────────
function ChangePasswordModal({ onClose, onSuccess }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!current) return setError('Enter your current password.');
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (!/[A-Za-z]/.test(next)) return setError('Include at least one letter.');
    if (!/[0-9]/.test(next)) return setError('Include at least one number.');
    if (next !== confirm) return setError('Passwords do not match.');
    if (current === next) return setError('New password must be different from the current one.');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    height: 40, border: '1px solid #d1cfc8', borderRadius: 6,
    padding: '0 40px 0 12px', fontFamily: 'inherit', fontSize: 14,
    width: '100%', boxSizing: 'border-box', background: '#fff',
  };

  const wrapStyle = { position: 'relative', display: 'flex', alignItems: 'center' };
  const toggleStyle = {
    position: 'absolute', right: 10, background: 'transparent', border: 0,
    color: '#888', cursor: 'pointer', display: 'flex', padding: 4,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
        width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Change Password</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#888', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <CheckCircle2 size={44} style={{ color: '#16a34a', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>Password updated!</p>
            <p style={{ color: '#888', fontSize: 13, margin: '0 0 20px' }}>Your new password is active.</p>
            <button
              onClick={onSuccess}
              style={{ background: '#f59e0b', color: '#fff', border: 0, borderRadius: 7, padding: '10px 28px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
            >Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'grid', gap: 6 }}>
              Current password
              <div style={wrapStyle}>
                <input type={showCurrent ? 'text' : 'password'} style={inputStyle} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Your current password" />
                <button type="button" style={toggleStyle} onClick={() => setShowCurrent(v => !v)}>{showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </label>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'grid', gap: 6 }}>
              New password
              <div style={wrapStyle}>
                <input type={showNext ? 'text' : 'password'} style={inputStyle} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min. 8 chars, letters + numbers" />
                <button type="button" style={toggleStyle} onClick={() => setShowNext(v => !v)}>{showNext ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </label>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'grid', gap: 6 }}>
              Confirm new password
              <div style={wrapStyle}>
                <input type={showConfirm ? 'text' : 'password'} style={inputStyle} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" />
                <button type="button" style={toggleStyle} onClick={() => setShowConfirm(v => !v)}>{showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </label>
            {error && <p style={{ margin: 0, fontSize: 13, color: '#dc2626', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid #d1cfc8', borderRadius: 7, padding: '9px 20px', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button type="submit" disabled={busy} style={{ background: '#f59e0b', color: '#fff', border: 0, borderRadius: 7, padding: '9px 22px', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Main Header ──────────────────────────────────────────────────────
export default function Header({ user, title, onToggleMobileNav, extraActions, onLogout }) {
  const [open, setOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [profile, setProfile] = useState(null);
  const dropdownRef = useRef();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch fresh profile when dropdown opens
  useEffect(() => {
    if (open && !profile) {
      api.get('/auth/me').then(res => setProfile(res.data.data.user)).catch(() => {});
    }
  }, [open]);

  const u = profile || user;
  const roleLabel = ROLE_LABELS[u?.role] || (u?.role?.replaceAll('_', ' ') ?? 'User');
  const initial = u?.name ? u.name[0].toUpperCase() : 'U';

  async function handleLogout() {
    setOpen(false);
    try { await api.post('/auth/logout'); } catch (_) {}
    onLogout?.();
  }

  return (
    <>
      {showChangePw && (
        <ChangePasswordModal
          onClose={() => setShowChangePw(false)}
          onSuccess={() => setShowChangePw(false)}
        />
      )}

      {/* Mobile top bar */}
      <div className="mobile-top">
        <button onClick={onToggleMobileNav} className="mobile-menu-btn" aria-label="Toggle navigation">
          <Menu size={22} />
        </button>
        <div className="mobile-brand-title">
          <img src="/logo.png" alt="Logo" className="site-logo-mobile" />
        </div>
        <button
          className="avatar sm"
          onClick={() => setOpen(v => !v)}
          style={{ cursor: 'pointer', border: 0, background: 'var(--sun,#f59e0b)', color: '#fff' }}
        >
          {initial}
        </button>
      </div>

      {/* Desktop header */}
      <header className="app-header">
        <div>
          <p className="eyebrow">WORKSPACE / {roleLabel.toUpperCase()}</p>
          <h1>{title}</h1>
        </div>

        <div className="header-actions">
          {extraActions}

          {/* Profile dropdown trigger */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, background: 'transparent',
                border: '1px solid #e2ddd4', borderRadius: 30, padding: '6px 14px 6px 6px',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="avatar" style={{ width: 34, height: 34, fontSize: 14, flexShrink: 0 }}>{initial}</span>
              <div style={{ textAlign: 'left', lineHeight: 1.3 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>{roleLabel}</div>
              </div>
              <ChevronDown size={14} style={{ color: '#888', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>

            {/* Dropdown panel */}
            {open && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000,
                background: '#fff', borderRadius: 14, overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0,0,0,0.16)', border: '1px solid #ece8de',
                width: 320, animation: 'fadeSlideDown 0.15s ease',
              }}>

                {/* Header strip */}
                <div style={{ background: 'linear-gradient(135deg,#1a1a1a 0%,#2d2a22 100%)', padding: '20px 18px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{
                      width: 52, height: 52, borderRadius: '50%', background: '#f59e0b',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 800, flexShrink: 0,
                    }}>{initial}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{u?.name}</div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5,
                        background: 'rgba(245,158,11,0.2)', color: '#f59e0b',
                        borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                      }}>
                        <Shield size={10} /> {roleLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details grid */}
                <div style={{ padding: '14px 18px 4px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Account Details</p>
                  <div style={{ display: 'grid', gap: 9 }}>
                    {u?.email && (
                      <DetailRow icon={<Mail size={13} />} label="Email" value={u.email} />
                    )}
                    {u?.phone && (
                      <DetailRow icon={<Phone size={13} />} label="Phone" value={u.phone} />
                    )}
                    <DetailRow icon={<Hash size={13} />} label="Account ID" value={u?.id ? u.id.slice(0, 16) + '…' : '—'} mono />
                    <DetailRow icon={<BadgeCheck size={13} />} label="Status" value={
                      <span style={{ color: u?.isActive ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                        {u?.isActive ? '● Active' : '● Inactive'}
                      </span>
                    } />
                    {u?.hourlyRate && (
                      <DetailRow icon={<IndianRupee size={13} />} label="Hourly Rate" value={`₹${Number(u.hourlyRate).toLocaleString('en-IN')} / hr`} />
                    )}
                    <DetailRow icon={<Clock size={13} />} label="Last Login" value={fmt(u?.lastLoginAt)} />
                    <DetailRow icon={<CalendarDays size={13} />} label="Member Since" value={fmtDate(u?.createdAt)} />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ padding: '12px 10px 6px', borderTop: '1px solid #f0ece3', marginTop: 12 }}>
                  <button
                    onClick={() => { setOpen(false); setShowChangePw(true); }}
                    style={menuItemStyle}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Lock size={15} style={{ color: '#888' }} />
                    <span>Change Password</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{ ...menuItemStyle, color: '#dc2626' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fff5f5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={15} style={{ color: '#dc2626' }} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <style>{`@keyframes fadeSlideDown { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </>
  );
}

function DetailRow({ icon, label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ color: '#aaa', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#333', fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  background: 'transparent', border: 0, padding: '10px 16px',
  fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
  color: '#333', transition: 'background 0.1s',
};
