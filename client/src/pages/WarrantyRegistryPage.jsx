import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Calendar,
  Layers,
  ArrowRight,
  Sun,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

export default function WarrantyRegistryPage() {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    loadWarranties();
  }, [search]);

  async function loadWarranties() {
    setLoading(true);
    try {
      const res = await api.get('/inventory/warranties', { params: { q: search } });
      setWarranties(res.data.data || []);
    } catch (err) {
      setWarranties([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredWarranties = warranties.filter((w) => {
    if (statusFilter === 'ACTIVE') return w.isUnderWarranty;
    if (statusFilter === 'EXPIRED') return !w.isUnderWarranty;
    return true;
  });

  return (
    <div className="warranty-registry-page">
      {/* Top Banner */}
      <div className="welcome-card mb-4">
        <div>
          <p className="eyebrow text-amber-400">AUTOMATIC WARRANTY CLOCK — STARTS AT DELIVERY CONFIRMATION</p>
          <h2>Official Solar Hardware Warranty Registry</h2>
          <p>
            Warranty clock starts the exact moment delivery is confirmed on-site. Duration is set per product
            (e.g. 240 months for panels, 24 months for inverters). All serial numbers are permanently recorded.
          </p>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="page-toolbar mb-4 flex justify-between items-center gap-3">
        <div className="search-box-wrap flex-1">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by serial number (e.g. 1234567891), customer name, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="status-tab-bar">
          <button
            className={`tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Registered Units ({warranties.length})
          </button>
          <button
            className={`tab-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Active Coverage
          </button>
          <button
            className={`tab-btn ${statusFilter === 'EXPIRED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('EXPIRED')}
          >
            Expired
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="panel">
        <div className="panel-head mb-3">
          <div>
            <h2>Registered Equipment Units & Certificates</h2>
            <p>Every serialized solar panel, inverter, and battery tracked to customer rooftop.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted p-6">Loading warranty register…</p>
        ) : filteredWarranties.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={32} />
            <h3>No warranties found</h3>
            <p>Serialized equipment units appear here automatically once delivery is completed.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Serial Number</th>
                  <th>Equipment Product</th>
                  <th>Homeowner</th>
                  <th>Project Code</th>
                  <th>Delivery Date</th>
                  <th>Expiry Date</th>
                  <th>Coverage Remaining</th>
                  <th>Status</th>
                  <th>Certificate</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarranties.map((w) => (
                  <tr key={w.id} className="clickable-row" onClick={() => setSelectedWarranty(w)}>
                    <td>
                      <strong className="font-mono text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
                        {w.serialUnit?.serialNumber}
                      </strong>
                    </td>
                    <td>
                      <div className="font-semibold">{w.serialUnit?.product?.name}</div>
                      <small className="muted">{w.serialUnit?.product?.category}</small>
                    </td>
                    <td>
                      <div>{w.customer?.name}</div>
                      <small className="muted">{w.customer?.phone}</small>
                    </td>
                    <td>{w.project?.code || '—'}</td>
                    <td>
                      <span>{new Date(w.startDate).toLocaleDateString('en-IN')}</span>
                      <small className="muted block">{new Date(w.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                    </td>
                    <td><strong>{new Date(w.endDate).toLocaleDateString('en-IN')}</strong></td>
                    <td>
                      {w.isUnderWarranty ? (
                        <span className="text-emerald-700 font-semibold">
                          {w.daysRemaining >= 365
                            ? `${Math.floor(w.daysRemaining / 365)} yr${Math.floor(w.daysRemaining / 365) > 1 ? 's' : ''} ${Math.floor((w.daysRemaining % 365) / 30)} mo`
                            : `${w.daysRemaining} days`} remaining
                        </span>
                      ) : (
                        <span className="text-red-700 font-semibold">Expired</span>
                      )}
                    </td>
                    <td>
                      {w.isUnderWarranty ? (
                        <span className="badge-green text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 font-bold">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="badge-red text-xs px-2 py-0.5 rounded font-bold">
                          Expired
                        </span>
                      )}
                    </td>
                    <td>
                      <button className="button outline small-button text-xs">View Certificate</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Digital Certificate Modal */}
      {selectedWarranty && (
        <Modal
          isOpen={Boolean(selectedWarranty)}
          onClose={() => setSelectedWarranty(null)}
          title="Official Solar Equipment Warranty Certificate"
          subtitle={`SunPower Solutions Guarantee · Serial ${selectedWarranty.serialUnit?.serialNumber}`}
          maxWidth="680px"
        >
          <div className="warranty-certificate-card p-6 border-2 border-amber-300 rounded-lg bg-amber-50/40 text-center relative">
            <div className="certificate-header mb-4">
              <div className="inline-grid place-items-center w-12 h-12 rounded-full bg-amber-500 text-slate-900 mx-auto mb-2">
                <Sun size={26} />
              </div>
              <h3 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">SunPower Solutions</h3>
              <p className="text-xs uppercase tracking-widest text-amber-900 font-bold">
                Certificate of Limited Warranty & Performance Guarantee
              </p>
            </div>

            <p className="text-sm text-slate-700 max-w-lg mx-auto mb-5">
              This certifies that the solar equipment specified below was manufactured and tested to industry standards,
              installed under quality protocols, and is backed by SunPower Solutions.
            </p>

            <div className="grid grid-cols-2 gap-4 text-left text-xs bg-white p-4 border rounded shadow-sm max-w-lg mx-auto mb-4">
              <div>
                <span className="muted block">Customer Name:</span>
                <strong className="text-sm">{selectedWarranty.customer?.name}</strong>
              </div>
              <div>
                <span className="muted block">Contact Number:</span>
                <strong className="text-sm">{selectedWarranty.customer?.phone || '—'}</strong>
              </div>
              <div>
                <span className="muted block">Installation Site:</span>
                <strong className="text-sm">
                  {[selectedWarranty.customer?.addressLine, selectedWarranty.customer?.city, selectedWarranty.customer?.state]
                    .filter(Boolean).join(', ') || '—'}
                </strong>
              </div>
              <div>
                <span className="muted block">Project Code:</span>
                <strong className="text-sm">{selectedWarranty.project?.code || '—'}</strong>
              </div>
              <div>
                <span className="muted block">Product Model:</span>
                <strong className="text-sm">{selectedWarranty.serialUnit?.product?.name}</strong>
              </div>
              <div>
                <span className="muted block">Category:</span>
                <strong className="text-sm">{selectedWarranty.serialUnit?.product?.category || '—'}</strong>
              </div>
              <div>
                <span className="muted block">Serial Number:</span>
                <strong className="text-sm font-mono text-amber-900">{selectedWarranty.serialUnit?.serialNumber}</strong>
              </div>
              <div>
                <span className="muted block">Warranty Duration:</span>
                <strong className="text-sm">
                  {selectedWarranty.warrantyMonths >= 12
                    ? `${selectedWarranty.warrantyMonths / 12} Year${selectedWarranty.warrantyMonths / 12 > 1 ? 's' : ''}`
                    : `${selectedWarranty.warrantyMonths} Months`}
                </strong>
              </div>
              <div>
                <span className="muted block">Warranty Start (Delivery Confirmed):</span>
                <strong className="text-sm">
                  {new Date(selectedWarranty.startDate).toLocaleDateString('en-IN')}{' '}
                  <span style={{color:'var(--muted)',fontWeight:400}}>
                    {new Date(selectedWarranty.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </strong>
              </div>
              <div>
                <span className="muted block">Warranty Expiry Date:</span>
                <strong className="text-sm text-emerald-800">{new Date(selectedWarranty.endDate).toLocaleDateString('en-IN')}</strong>
              </div>
            </div>

            <div className="text-xs text-slate-600 mb-6 flex justify-between max-w-lg mx-auto border-t pt-3">
              <div>
                <strong>Terms:</strong> Free replacement and repairs under manufacturing defect.
              </div>
              <div className="font-bold text-emerald-800">
                {selectedWarranty.isUnderWarranty ? 'Status: 100% VALID & ACTIVE' : 'Status: EXPIRED'}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="button outline small-button"
                onClick={() => window.print()}
              >
                <Printer size={15} /> Print Certificate
              </button>
              <button
                type="button"
                className="button primary small-button"
                onClick={() => setSelectedWarranty(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

