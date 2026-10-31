import React, { useEffect, useState } from 'react';
import { UserCog, Save, UserPlus, X, Eye, EyeOff, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { detectGibberish } from '../shared/gibberish.js';
import Modal from '../components/Modal.jsx';

const ALL_ROLES = [
  { value: 'SUPER_ADMIN',            label: 'Super Admin',             color: '#7c3aed', bg: '#ede9fe' },
  { value: 'DIRECTOR',               label: 'Director',                color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'SALES_EXECUTIVE',        label: 'Sales Executive',         color: '#065f46', bg: '#d1fae5' },
  { value: 'SURVEY_TECHNICIAN',      label: 'Survey Technician',       color: '#92400e', bg: '#fef3c7' },
  { value: 'WAREHOUSE_MANAGER',      label: 'Warehouse Manager',       color: '#1e40af', bg: '#dbeafe' },
  { value: 'INSTALLATION_TECHNICIAN',label: 'Installation Technician', color: '#065f46', bg: '#dcfce7' },
  { value: 'SUPPORT_EXECUTIVE',      label: 'Support Executive',       color: '#9a3412', bg: '#ffedd5' },
];

function RoleBadge({ role }) {
  const def = ALL_ROLES.find((r) => r.value === role);
  return (
    <span style={{
      display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
      background: def?.bg || '#f1eee7', color: def?.color || 'var(--ink)',
    }}>
      {def?.label || role.replaceAll('_', ' ')}
    </span>
  );
}

function StatusBadgePill({ isActive }) {
  return (
    <span style={{
      display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
      background: isActive ? '#dcfce7' : '#fee2e2',
      color: isActive ? '#166534' : '#991b1b',
    }}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

const BLANK_FORM = { name: '', email: '', phone: '', role: 'INSTALLATION_TECHNICIAN', password: '', hourlyRate: '' };

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState({});
  const [saving, setSaving] = useState({});
  const [rateMsg, setRateMsg] = useState({});

  // Add member modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [showPw, setShowPw] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');

  // Toggle active
  const [togglingId, setTogglingId] = useState(null);

  // Collapsed role groups
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/users');
      const list = res.data.data || [];
      setUsers(list);
      const init = {};
      list.forEach((u) => { init[u.id] = u.hourlyRate != null ? String(u.hourlyRate) : ''; });
      setRates(init);
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function saveRate(userId) {
    setSaving((s) => ({ ...s, [userId]: true }));
    setRateMsg((m) => ({ ...m, [userId]: '' }));
    try {
      await api.patch(`/users/${userId}`, { hourlyRate: parseFloat(rates[userId]) || 0 });
      setRateMsg((m) => ({ ...m, [userId]: 'saved' }));
    } catch (e) {
      setRateMsg((m) => ({ ...m, [userId]: errorText(e) }));
    } finally {
      setSaving((s) => ({ ...s, [userId]: false }));
    }
  }

  async function toggleStatus(u) {
    setTogglingId(u.id);
    try {
      await api.patch(`/users/${u.id}/status`, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
    } catch (_) {}
    finally { setTogglingId(null); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAddError('');
    if (!form.name.trim() || form.name.trim().length < 2) return setAddError('Full name must be at least 2 characters.');
    if (form.name.trim().length > 100) return setAddError('Full name is too long (max 100 characters).');
    const nameGibberish = detectGibberish(form.name.trim(), 'Name');
    if (nameGibberish) return setAddError(nameGibberish);
    if (form.phone && !/^[0-9]{10}$/.test(form.phone.trim())) return setAddError('Phone must be exactly 10 digits.');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setAddError('Enter a valid email address.');
    if (form.role === 'INSTALLATION_TECHNICIAN' && form.hourlyRate && (Number(form.hourlyRate) < 0 || Number(form.hourlyRate) > 10000)) return setAddError('Hourly rate must be between ₹0 and ₹10,000.');
    if (!form.password || form.password.length < 8) return setAddError('Password must be at least 8 characters.');
    setAddBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role,
        password: form.password,
        ...(form.email ? { email: form.email.trim() } : {}),
        ...(form.phone ? { phone: form.phone.trim() } : {}),
        ...(form.hourlyRate ? { hourlyRate: parseFloat(form.hourlyRate) } : {}),
      };
      await api.post('/users', payload);
      setAddOpen(false);
      setForm(BLANK_FORM);
      await load();
    } catch (err) {
      setAddError(errorText(err));
    } finally {
      setAddBusy(false);
    }
  }

  // Group by role in the defined order
  const grouped = ALL_ROLES.map((roleDef) => ({
    ...roleDef,
    members: users.filter((u) => u.role === roleDef.value),
  })).filter((g) => g.members.length > 0);

  return (
    <div>
      {/* Banner */}
      <div className="welcome-card mb-5">
        <div>
          <p className="eyebrow">SUPER ADMIN</p>
          <h2>Team & Pay Rates</h2>
          <p>Add team members, assign roles, set hourly rates for technicians, and manage account status.</p>
        </div>
        <div className="sun-orbit"><UserCog size={38} /></div>
      </div>

      {/* Stats + Add button */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
          {ALL_ROLES.map((r) => {
            const count = users.filter((u) => u.role === r.value).length;
            if (!count) return null;
            return (
              <div key={r.value} style={{display:'flex',alignItems:'center',gap:6,fontSize:13}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:r.color,display:'inline-block'}} />
                <span style={{color:'var(--muted)'}}>{r.label}:</span>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
        <button className="button primary" style={{gap:8}} onClick={() => { setForm(BLANK_FORM); setAddError(''); setAddOpen(true); }}>
          <UserPlus size={16} /> Add New Member
        </button>
      </div>

      {/* Role-grouped sections */}
      {loading ? (
        <div className="panel p-6"><p className="muted">Loading team…</p></div>
      ) : users.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <Users size={32} /><h3>No team members yet</h3>
            <p>Click "Add New Member" to create the first account.</p>
          </div>
        </div>
      ) : (
        <div style={{display:'grid',gap:14}}>
          {grouped.map((group) => {
            const isCollapsed = collapsed[group.value];
            return (
              <div key={group.value} style={{background:'#fff',border:'1px solid var(--line)',borderRadius:10,overflow:'hidden'}}>
                {/* Group header */}
                <button
                  style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 20px',background:'transparent',border:0,cursor:'pointer',textAlign:'left'}}
                  onClick={() => setCollapsed((c) => ({ ...c, [group.value]: !c[group.value] }))}
                >
                  <span style={{width:10,height:10,borderRadius:'50%',background:group.color,flexShrink:0}} />
                  <strong style={{fontSize:15,flex:1}}>{group.label}</strong>
                  <span style={{fontSize:12,color:'var(--muted)',marginRight:8}}>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
                  {isCollapsed ? <ChevronRight size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
                </button>

                {/* Members table */}
                {!isCollapsed && (
                  <div style={{borderTop:'1px solid var(--line)'}}>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Email</th>
                            <th>Status</th>
                            {group.value === 'INSTALLATION_TECHNICIAN' && <th>Hourly Rate</th>}
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.members.map((u) => (
                            <tr key={u.id}>
                              <td>
                                <strong>{u.name}</strong>
                                <small className="muted block" style={{fontSize:11}}>Since {new Date(u.createdAt).toLocaleDateString('en-IN')}</small>
                              </td>
                              <td>{u.phone || <span className="muted">—</span>}</td>
                              <td>{u.email || <span className="muted">—</span>}</td>
                              <td><StatusBadgePill isActive={u.isActive} /></td>

                              {group.value === 'INSTALLATION_TECHNICIAN' && (
                                <td>
                                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                                    <span style={{color:'var(--muted)',fontSize:13}}>₹</span>
                                    <input
                                      type="number" min="0" step="10"
                                      style={{width:90,height:34,border:'1px solid #cfc8ba',borderRadius:6,padding:'0 8px',fontFamily:'inherit',fontSize:13}}
                                      value={rates[u.id] ?? ''}
                                      onChange={(e) => setRates((r) => ({ ...r, [u.id]: e.target.value }))}
                                      placeholder="0"
                                    />
                                    <span style={{color:'var(--muted)',fontSize:11}}>/hr</span>
                                    <button
                                      className="button primary small-button"
                                      disabled={saving[u.id]}
                                      onClick={() => saveRate(u.id)}
                                      style={{minHeight:34,padding:'0 10px',fontSize:12}}
                                    >
                                      <Save size={12} /> {saving[u.id] ? '…' : 'Save'}
                                    </button>
                                  </div>
                                  {rateMsg[u.id] === 'saved' && <p style={{color:'var(--green)',fontSize:11,margin:'3px 0 0'}}>✓ Saved</p>}
                                  {rateMsg[u.id] && rateMsg[u.id] !== 'saved' && <p style={{color:'var(--red)',fontSize:11,margin:'3px 0 0'}}>{rateMsg[u.id]}</p>}
                                </td>
                              )}

                              <td>
                                <button
                                  className="button outline small-button"
                                  disabled={togglingId === u.id}
                                  onClick={() => toggleStatus(u)}
                                  style={{fontSize:12,minHeight:32,padding:'0 12px', color: u.isActive ? 'var(--red)' : 'var(--green)', borderColor: u.isActive ? 'var(--red)' : 'var(--green)'}}
                                >
                                  {togglingId === u.id ? '…' : u.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Team Member"
        subtitle="Create a login account for a new staff member with a specific role."
        maxWidth="520px"
      >
        <form onSubmit={handleAdd} style={{display:'grid',gap:14}}>
          {addError && <p style={{color:'var(--red)',fontSize:13,margin:0,padding:'8px 12px',background:'#fff5f5',borderRadius:6,border:'1px solid #fecaca'}}>{addError}</p>}

          <label style={{fontSize:13,fontWeight:600,display:'grid',gap:6}}>
            Full Name *
            <input
              type="text" required placeholder="e.g. Ravi Patel"
              value={form.name}
              onChange={(e) => {
                const raw = e.target.value;
                const v = raw.replace(/[^A-Za-zऀ-ॿ\s.''-]/g, '');
                setForm({...form, name: v});
                if (raw !== v) setAddError('Name can only contain letters — no numbers or special characters.');
                else if (addError && addError.startsWith('Name')) setAddError('');
              }}
              style={{height:42,border:'1px solid #cfc8ba',borderRadius:6,padding:'0 12px',fontFamily:'inherit'}}
            />
          </label>

          <label style={{fontSize:13,fontWeight:600,display:'grid',gap:6}}>
            Role *
            <select
              value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}
              style={{height:42,border:'1px solid #cfc8ba',borderRadius:6,padding:'0 12px',fontFamily:'inherit',background:'#fff'}}
            >
              {ALL_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <label style={{fontSize:13,fontWeight:600,display:'grid',gap:6}}>
              Phone
              <input
                type="tel" placeholder="10-digit number"
                value={form.phone}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setForm({...form, phone: v});
                  if (e.target.value !== v && e.target.value.length > 0) setAddError('Phone number must contain digits only.');
                  else if (addError && addError.startsWith('Phone')) setAddError('');
                }}
                style={{height:42,border:'1px solid #cfc8ba',borderRadius:6,padding:'0 12px',fontFamily:'inherit'}}
              />
            </label>
            <label style={{fontSize:13,fontWeight:600,display:'grid',gap:6}}>
              Email
              <input
                type="email" placeholder="optional"
                value={form.email}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({...form, email: v});
                  if (v.length > 5 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) setAddError('Enter a valid email address.');
                  else if (addError && addError.startsWith('Enter a valid email')) setAddError('');
                }}
                style={{height:42,border:'1px solid #cfc8ba',borderRadius:6,padding:'0 12px',fontFamily:'inherit'}}
              />
            </label>
          </div>

          {form.role === 'INSTALLATION_TECHNICIAN' && (
            <label style={{fontSize:13,fontWeight:600,display:'grid',gap:6}}>
              Hourly Pay Rate (₹/hr)
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{color:'var(--muted)'}}>₹</span>
                <input
                  type="number" min="0" step="10" placeholder="e.g. 250"
                  value={form.hourlyRate} onChange={(e) => setForm({...form, hourlyRate: e.target.value})}
                  style={{flex:1,height:42,border:'1px solid #cfc8ba',borderRadius:6,padding:'0 12px',fontFamily:'inherit'}}
                />
                <span style={{color:'var(--muted)',fontSize:12}}>/hr</span>
              </div>
            </label>
          )}

          <label style={{fontSize:13,fontWeight:600,display:'grid',gap:6}}>
            Password *
            <div style={{position:'relative',display:'flex',alignItems:'center'}}>
              <input
                type={showPw ? 'text' : 'password'}
                required minLength={8}
                placeholder="Min. 8 characters"
                value={form.password} onChange={(e) => setForm({...form, password: e.target.value})}
                style={{flex:1,height:42,border:'1px solid #cfc8ba',borderRadius:6,padding:'0 40px 0 12px',fontFamily:'inherit'}}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{position:'absolute',right:10,border:0,background:'transparent',color:'var(--muted)',display:'flex',alignItems:'center',cursor:'pointer'}}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small style={{color:'var(--muted)',fontWeight:400}}>The member will use this password to log in.</small>
          </label>

          <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
            <button type="button" className="button outline small-button" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="submit" className="button primary small-button" disabled={addBusy}>
              <UserPlus size={14} /> {addBusy ? 'Creating…' : 'Create Member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
