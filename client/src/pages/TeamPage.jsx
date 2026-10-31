import React, { useEffect, useState } from 'react';
import { UserCog, IndianRupee, Save } from 'lucide-react';
import { api, errorText } from '../shared/api.js';

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [rates, setRates] = useState({});
  const [messages, setMessages] = useState({});

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
    setMessages((m) => ({ ...m, [userId]: '' }));
    try {
      await api.patch(`/users/${userId}`, { hourlyRate: parseFloat(rates[userId]) || 0 });
      setMessages((m) => ({ ...m, [userId]: 'saved' }));
    } catch (e) {
      setMessages((m) => ({ ...m, [userId]: errorText(e) }));
    } finally {
      setSaving((s) => ({ ...s, [userId]: false }));
    }
  }

  const technicians = users.filter((u) => u.role === 'INSTALLATION_TECHNICIAN');
  const others = users.filter((u) => u.role !== 'INSTALLATION_TECHNICIAN');

  return (
    <div>
      <div className="welcome-card mb-5">
        <div>
          <p className="eyebrow">SUPER ADMIN</p>
          <h2>Team & Pay Rates</h2>
          <p>Set hourly rates for installation technicians. Earnings are calculated automatically when jobs are completed.</p>
        </div>
        <div className="sun-orbit"><UserCog size={38} /></div>
      </div>

      <div className="panel p-5">
        <div className="panel-head mb-4">
          <div>
            <h2>Installation Technicians</h2>
            <p>Set the per-hour rate for each technician. Changes take effect on the next job completion.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted">Loading team…</p>
        ) : technicians.length === 0 ? (
          <div className="empty-state"><UserCog size={32} /><h3>No technicians found</h3><p>Add installation technician accounts to set their pay rates here.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Hourly Rate (₹)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {technicians.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <small className="muted">Installation Technician</small>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span style={{
                        display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                        background: u.isActive ? '#dcfce7' : '#fee2e2',
                        color: u.isActive ? '#166534' : '#991b1b',
                      }}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{color:'var(--muted)'}}>₹</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          style={{width:100,height:36,border:'1px solid #cfc8ba',borderRadius:6,padding:'0 10px',fontFamily:'inherit'}}
                          value={rates[u.id] ?? ''}
                          onChange={(e) => setRates((r) => ({ ...r, [u.id]: e.target.value }))}
                          placeholder="e.g. 250"
                        />
                        <span style={{color:'var(--muted)',fontSize:12}}>/hr</span>
                      </div>
                      {messages[u.id] === 'saved' && <p style={{color:'var(--green)',fontSize:12,margin:'4px 0 0'}}>✓ Rate saved</p>}
                      {messages[u.id] && messages[u.id] !== 'saved' && <p style={{color:'var(--red)',fontSize:12,margin:'4px 0 0'}}>{messages[u.id]}</p>}
                    </td>
                    <td>
                      <button
                        className="button primary small-button"
                        disabled={saving[u.id]}
                        onClick={() => saveRate(u.id)}
                        style={{minHeight:36,padding:'0 14px',fontSize:13}}
                      >
                        <Save size={13} />
                        {saving[u.id] ? 'Saving…' : 'Save Rate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div className="panel p-5 mt-4">
          <div className="panel-head mb-3">
            <div>
              <h2>All Team Members</h2>
              <p>All active staff accounts in the system.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
              </thead>
              <tbody>
                {others.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td style={{fontSize:12,color:'var(--muted)'}}>{u.role.replaceAll('_', ' ')}</td>
                    <td>
                      <span style={{
                        display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                        background: u.isActive ? '#dcfce7' : '#fee2e2',
                        color: u.isActive ? '#166534' : '#991b1b',
                      }}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
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
}
