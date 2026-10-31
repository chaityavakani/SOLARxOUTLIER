import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Printer,
  Sun,
  User,
  Phone,
  MapPin,
  FolderOpen,
  Folder,
} from 'lucide-react';
import { api } from '../shared/api.js';
import Modal from '../components/Modal.jsx';

export default function WarrantyRegistryPage() {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openFolders, setOpenFolders] = useState({});
  const [selectedWarranty, setSelectedWarranty] = useState(null);

  useEffect(() => { loadWarranties(); }, [search]);

  async function loadWarranties() {
    setLoading(true);
    try {
      const res = await api.get('/inventory/warranties', { params: { q: search } });
      const list = res.data.data || [];
      setWarranties(list);
      // Auto-open all folders on first load
      const folderState = {};
      const seen = new Set();
      list.forEach((w) => {
        const cid = w.customer?.id || 'unknown';
        if (!seen.has(cid)) { folderState[cid] = true; seen.add(cid); }
      });
      setOpenFolders(folderState);
    } catch (_) {
      setWarranties([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleFolder(customerId) {
    setOpenFolders((prev) => ({ ...prev, [customerId]: !prev[customerId] }));
  }

  // Group warranties by customer
  const filtered = warranties.filter((w) => {
    if (statusFilter === 'ACTIVE') return w.isUnderWarranty;
    if (statusFilter === 'EXPIRED') return !w.isUnderWarranty;
    return true;
  });

  const grouped = [];
  const seenMap = {};
  filtered.forEach((w) => {
    const cid = w.customer?.id || 'unknown';
    if (!seenMap[cid]) {
      seenMap[cid] = { customer: w.customer, project: w.project, items: [] };
      grouped.push(seenMap[cid]);
    }
    seenMap[cid].items.push(w);
  });

  const activeCount = warranties.filter((w) => w.isUnderWarranty).length;
  const expiredCount = warranties.filter((w) => !w.isUnderWarranty).length;

  return (
    <div className="warranty-registry-page">
      {/* Banner */}
      <div className="welcome-card mb-4">
        <div>
          <p className="eyebrow" style={{color:'#fbbf24'}}>AUTOMATIC WARRANTY CLOCK — STARTS AT DELIVERY CONFIRMATION</p>
          <h2>Official Solar Hardware Warranty Registry</h2>
          <p>Warranties are grouped by customer. Clock starts the exact moment delivery is confirmed on-site.</p>
        </div>
        <div className="sun-orbit"><ShieldCheck size={38} /></div>
      </div>

      {/* Stats row */}
      <div className="stat-grid mb-4" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="stat-card">
          <span className="stat-icon"><FolderOpen size={20} /></span>
          <strong>{grouped.length || warranties.filter((w,i,a) => a.findIndex(x=>x.customer?.id===w.customer?.id)===i).length}</strong>
          <small>Customer Folders</small>
        </div>
        <div className="stat-card">
          <span className="stat-icon" style={{color:'var(--green)'}}><CheckCircle2 size={20} /></span>
          <strong style={{color:'var(--green)'}}>{activeCount}</strong>
          <small>Active Warranties</small>
        </div>
        <div className="stat-card">
          <span className="stat-icon" style={{color:'var(--red)'}}><ShieldCheck size={20} /></span>
          <strong style={{color:'var(--red)'}}>{expiredCount}</strong>
          <small>Expired</small>
        </div>
      </div>

      {/* Toolbar */}
      <div className="page-toolbar mb-4 flex justify-between items-center gap-3 flex-wrap">
        <div className="search-box-wrap" style={{flex:1,minWidth:220}}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by serial, customer name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="status-tab-bar">
          <button className={`tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`} onClick={() => setStatusFilter('ALL')}>
            All ({warranties.length})
          </button>
          <button className={`tab-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`} onClick={() => setStatusFilter('ACTIVE')}>
            Active ({activeCount})
          </button>
          <button className={`tab-btn ${statusFilter === 'EXPIRED' ? 'active' : ''}`} onClick={() => setStatusFilter('EXPIRED')}>
            Expired ({expiredCount})
          </button>
        </div>
      </div>

      {/* Customer Folders */}
      {loading ? (
        <div className="panel p-6"><p className="muted">Loading warranty register…</p></div>
      ) : grouped.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <ShieldCheck size={32} />
            <h3>No warranties found</h3>
            <p>Serialized equipment units appear here automatically once delivery is completed.</p>
          </div>
        </div>
      ) : (
        <div style={{display:'grid',gap:12}}>
          {grouped.map((group) => {
            const cid = group.customer?.id || 'unknown';
            const isOpen = openFolders[cid];
            const allActive = group.items.every((w) => w.isUnderWarranty);
            const anyExpired = group.items.some((w) => !w.isUnderWarranty);
            const activeItems = group.items.filter((w) => w.isUnderWarranty).length;

            return (
              <div key={cid} className="warranty-folder-card">
                {/* Folder Header — clickable */}
                <button
                  className="warranty-folder-header"
                  onClick={() => toggleFolder(cid)}
                >
                  <div className="folder-icon-wrap">
                    {isOpen
                      ? <FolderOpen size={22} style={{color:'var(--sun)'}} />
                      : <Folder size={22} style={{color:'var(--sun)'}} />}
                  </div>

                  <div className="folder-info">
                    <div className="folder-name">{group.customer?.name || 'Unknown Customer'}</div>
                    <div className="folder-meta">
                      <span><Phone size={11} /> {group.customer?.phone || '—'}</span>
                      {(group.customer?.city || group.customer?.state) && (
                        <span><MapPin size={11} /> {[group.customer?.city, group.customer?.state].filter(Boolean).join(', ')}</span>
                      )}
                      {group.project?.code && (
                        <span style={{fontFamily:'monospace',background:'#f1eee7',padding:'1px 6px',borderRadius:4}}>
                          {group.project.code}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="folder-badges">
                    <span className="folder-count-badge" style={{background:'#f1eee7',color:'var(--ink)'}}>
                      {group.items.length} unit{group.items.length !== 1 ? 's' : ''}
                    </span>
                    {activeItems > 0 && (
                      <span className="folder-count-badge" style={{background:'#dcfce7',color:'#166534'}}>
                        {activeItems} active
                      </span>
                    )}
                    {anyExpired && (
                      <span className="folder-count-badge" style={{background:'#fee2e2',color:'#991b1b'}}>
                        {group.items.length - activeItems} expired
                      </span>
                    )}
                  </div>

                  <div className="folder-chevron">
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {/* Folder Contents */}
                {isOpen && (
                  <div className="warranty-folder-body">
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Serial Number</th>
                            <th>Product</th>
                            <th>Duration</th>
                            <th>Warrany Start</th>
                            <th>Expiry</th>
                            <th>Remaining</th>
                            <th>Status</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((w) => (
                            <tr key={w.id}>
                              <td>
                                <span style={{fontFamily:'monospace',background:'#fffbeb',color:'#92400e',padding:'2px 8px',borderRadius:4,fontWeight:700,fontSize:12}}>
                                  {w.serialUnit?.serialNumber}
                                </span>
                              </td>
                              <td>
                                <div style={{fontWeight:600}}>{w.serialUnit?.product?.name}</div>
                                <small className="muted">{w.serialUnit?.product?.category}</small>
                              </td>
                              <td style={{fontSize:12,fontWeight:600}}>
                                {w.warrantyMonths >= 12
                                  ? `${w.warrantyMonths / 12} Yr`
                                  : `${w.warrantyMonths} Mo`}
                              </td>
                              <td>
                                <span style={{fontSize:12}}>{new Date(w.startDate).toLocaleDateString('en-IN')}</span>
                                <small className="muted block" style={{fontSize:10}}>{new Date(w.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                              </td>
                              <td style={{fontWeight:700,fontSize:13}}>{new Date(w.endDate).toLocaleDateString('en-IN')}</td>
                              <td>
                                {w.isUnderWarranty ? (
                                  <span style={{color:'var(--green)',fontWeight:600,fontSize:12}}>
                                    {w.daysRemaining >= 365
                                      ? `${Math.floor(w.daysRemaining / 365)}y ${Math.floor((w.daysRemaining % 365) / 30)}m`
                                      : `${w.daysRemaining}d`}
                                  </span>
                                ) : (
                                  <span style={{color:'var(--red)',fontWeight:600,fontSize:12}}>Expired</span>
                                )}
                              </td>
                              <td>
                                {w.isUnderWarranty ? (
                                  <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'#dcfce7',color:'#166534',padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700}}>
                                    <CheckCircle2 size={11} /> Active
                                  </span>
                                ) : (
                                  <span style={{background:'#fee2e2',color:'#991b1b',padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700,display:'inline-block'}}>
                                    Expired
                                  </span>
                                )}
                              </td>
                              <td>
                                <button
                                  className="button outline small-button"
                                  style={{fontSize:12,minHeight:30,padding:'0 10px'}}
                                  onClick={() => setSelectedWarranty(w)}
                                >
                                  Certificate
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

      {/* Digital Certificate Modal */}
      {selectedWarranty && (
        <Modal
          isOpen={Boolean(selectedWarranty)}
          onClose={() => setSelectedWarranty(null)}
          title="Official Solar Equipment Warranty Certificate"
          subtitle={`SunPower Solutions Guarantee · Serial ${selectedWarranty.serialUnit?.serialNumber}`}
          maxWidth="680px"
        >
          <div style={{border:'2px solid #fcd34d',borderRadius:10,background:'#fffdf5',padding:28,textAlign:'center'}}>
            <div style={{marginBottom:18}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'#f59e0b',display:'grid',placeItems:'center',margin:'0 auto 10px'}}>
                <Sun size={28} color="#1e2a3e" />
              </div>
              <h3 style={{fontFamily:'Outfit,system-ui,sans-serif',fontSize:22,margin:'0 0 4px',fontWeight:700}}>SunPower Solutions</h3>
              <p style={{fontSize:11,letterSpacing:'.14em',fontWeight:700,color:'#92400e',textTransform:'uppercase',margin:0}}>
                Certificate of Limited Warranty &amp; Performance Guarantee
              </p>
            </div>

            <p style={{fontSize:13,color:'#374151',maxWidth:480,margin:'0 auto 20px',lineHeight:1.6}}>
              This certifies that the solar equipment below was manufactured, tested to industry standards,
              and installed under quality protocols — backed by SunPower Solutions.
            </p>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 20px',textAlign:'left',fontSize:12,background:'#fff',padding:16,border:'1px solid #e5e7eb',borderRadius:8,maxWidth:500,margin:'0 auto 16px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
              {[
                ['Customer Name', selectedWarranty.customer?.name],
                ['Contact', selectedWarranty.customer?.phone || '—'],
                ['Installation Site', [selectedWarranty.customer?.addressLine, selectedWarranty.customer?.city, selectedWarranty.customer?.state].filter(Boolean).join(', ') || '—'],
                ['Project Code', selectedWarranty.project?.code || '—'],
                ['Product Model', selectedWarranty.serialUnit?.product?.name],
                ['Category', selectedWarranty.serialUnit?.product?.category || '—'],
                ['Serial Number', selectedWarranty.serialUnit?.serialNumber],
                ['Warranty Duration', selectedWarranty.warrantyMonths >= 12 ? `${selectedWarranty.warrantyMonths / 12} Year${selectedWarranty.warrantyMonths / 12 > 1 ? 's' : ''}` : `${selectedWarranty.warrantyMonths} Months`],
                ['Warranty Start', `${new Date(selectedWarranty.startDate).toLocaleDateString('en-IN')} ${new Date(selectedWarranty.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`],
                ['Expiry Date', new Date(selectedWarranty.endDate).toLocaleDateString('en-IN')],
              ].map(([label, value]) => (
                <div key={label}>
                  <span style={{color:'var(--muted)',display:'block',marginBottom:2}}>{label}:</span>
                  <strong style={{fontSize:13,fontFamily: label === 'Serial Number' ? 'monospace' : 'inherit', color: label === 'Serial Number' ? '#92400e' : label === 'Expiry Date' ? '#166534' : 'inherit'}}>
                    {value}
                  </strong>
                </div>
              ))}
            </div>

            <div style={{display:'flex',justifyContent:'space-between',maxWidth:500,margin:'0 auto 20px',fontSize:12,color:'#4b5563',borderTop:'1px solid #e5e7eb',paddingTop:10}}>
              <span><strong>Terms:</strong> Free replacement under manufacturing defect.</span>
              <span style={{fontWeight:700,color: selectedWarranty.isUnderWarranty ? '#166534' : '#991b1b'}}>
                {selectedWarranty.isUnderWarranty ? '✓ VALID & ACTIVE' : '✕ EXPIRED'}
              </span>
            </div>

            <div style={{display:'flex',justifyContent:'center',gap:10}}>
              <button className="button outline small-button" onClick={() => window.print()}>
                <Printer size={14} /> Print Certificate
              </button>
              <button className="button primary small-button" onClick={() => setSelectedWarranty(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
