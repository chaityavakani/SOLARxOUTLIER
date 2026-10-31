import React, { useEffect, useState } from 'react';
import {
  LifeBuoy,
  Search,
  Plus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  DollarSign,
  Phone,
  Barcode,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

export default function SupportTicketsPage({ user, onNavigate }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Instant Serial / Customer Warranty Lookup State
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Create Ticket Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerId: '',
    serialUnitId: '',
    projectId: '',
    category: 'INVERTER_FAULT',
    faultCode: 'ERR-04 Zero Power Generation',
    description: 'Inverter displaying fault code during heavy rains, zero power generation.',
    priority: 'HIGH',
    source: 'PHONE',
  });

  // Resolve Ticket Modal
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    labourHours: '2',
    parts: [],
  });

  // Close / Confirm Resolution Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmNote, setConfirmNote] = useState('Customer confirmed power generation is restored and working normally.');

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    setLoading(true);
    try {
      const res = await api.get('/tickets');
      setTickets(res.data.data || []);
    } catch (err) {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleLookup(e) {
    e?.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    setHasSearched(true);
    try {
      const res = await api.get(`/tickets/warranty-lookup?q=${encodeURIComponent(lookupQuery.trim())}`);
      setLookupResults(res.data.data || []);
    } catch (err) {
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  }

  function handleCreateFromLookup(item) {
    setCreateForm({
      customerId: item.customer?.id || '',
      serialUnitId: item.id,
      projectId: item.project?.id || '',
      category: item.product?.category === 'INVERTER' ? 'INVERTER_FAULT' : 'NO_POWER',
      faultCode: 'ERR-04 Zero Output',
      description: `Customer calls during rainy season: ${item.product?.name} (Serial: ${item.serialNumber}) showing fault code and zero power.`,
      priority: 'HIGH',
      source: 'PHONE',
    });
    setCreateModalOpen(true);
  }

  async function handleCreateTicketSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api.post('/tickets', createForm);
      setCreateModalOpen(false);
      loadTickets();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveSubmit(e) {
    e.preventDefault();
    if (!selectedTicket) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/tickets/${selectedTicket.id}/resolve`, {
        labourHours: Number(resolveForm.labourHours),
        parts: resolveForm.parts,
      });
      setResolveModalOpen(false);
      setSelectedTicket(null);
      loadTickets();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmSubmit(e) {
    e.preventDefault();
    if (!selectedTicket) return;
    setBusy(true);
    try {
      await api.post(`/tickets/${selectedTicket.id}/confirm`, { note: confirmNote });
      setConfirmModalOpen(false);
      setSelectedTicket(null);
      loadTickets();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === 'OPEN') return !['RESOLVED', 'CLOSED'].includes(t.status);
    if (statusFilter === 'RESOLVED') return t.status === 'RESOLVED';
    if (statusFilter === 'CLOSED') return t.status === 'CLOSED';
    return true;
  });

  return (
    <div className="support-tickets-page">
      {/* Top Banner */}
      <div className="welcome-card mb-4">
        <div>
          <p className="eyebrow text-amber-400">THE RAINY SEASON BREAKDOWN (SCENE 5)</p>
          <h2>Customer Support & Warranty Claim Desk</h2>
          <p>
            When a homeowner calls during rains with zero power, find their exact inverter serial number in seconds.
            Under warranty? The repair costs ₹0. Expired? Labour and parts are billed automatically.
          </p>
        </div>
        <button className="button primary small-button" onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} /> New Support Ticket
        </button>
      </div>

      {/* Instant Serial & Customer Lookup Bar (Scene 5) */}
      <div className="panel p-5 mb-6 bg-white shadow-sm border">
        <div className="panel-head mb-2">
          <div>
            <h3 className="flex items-center gap-2">
              <Search size={18} className="text-amber-600" />
              Instant Serial & Customer Warranty Lookup (Scene 5)
            </h3>
            <p className="text-xs muted">
              Type homeowner name, phone number, or inverter serial number to check warranty status in seconds.
            </p>
          </div>
        </div>

        <form onSubmit={handleLookup} className="flex gap-2 mb-3">
          <input
            type="text"
            required
            placeholder="Search by Inverter Serial (e.g. 1234567891) or Phone / Name…"
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            className="search-input flex-1"
          />
          <button type="submit" className="button primary small-button" disabled={lookupLoading}>
            <Search size={15} /> {lookupLoading ? 'Searching…' : 'Instant Lookup'}
          </button>
        </form>

        {/* Lookup Results */}
        {lookupLoading && <p className="muted text-sm p-3">Searching customer equipment database…</p>}

        {hasSearched && !lookupLoading && lookupResults.length === 0 && (
          <p className="text-sm muted p-2">No matching serial units or customers found for "{lookupQuery}".</p>
        )}

        {lookupResults.length > 0 && (
          <div className="lookup-results-list space-y-3 mt-3">
            {lookupResults.map((item) => (
              <div key={item.id} className="p-4 border rounded bg-slate-50 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-base font-bold text-slate-900">{item.product?.name}</strong>
                    <span className="font-mono text-xs bg-white px-2 py-0.5 border rounded">
                      Serial: {item.serialNumber}
                    </span>
                    <span className="text-xs text-slate-500">Project: {item.project?.code}</span>
                  </div>

                  <div className="text-xs muted flex gap-4 mt-1">
                    <span>Customer: <strong>{item.customer?.name}</strong></span>
                    <span>Phone: <strong>{item.customer?.phone}</strong></span>
                    <span>City: {item.customer?.city || 'Site'}</span>
                  </div>

                  {/* Coverage Policy Notice */}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {item.billingPolicy?.coverage === 'WARRANTY_COVERED' ? (
                      <span className="badge-green px-2 py-1 rounded inline-flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={13} /> 100% Free Warranty Coverage (Customer Cost: ₹0)
                      </span>
                    ) : (
                      <span className="badge-amber px-2 py-1 rounded inline-flex items-center gap-1 font-semibold">
                        <AlertTriangle size={13} /> Warranty Expired (Billable Rate: ₹350/hr + Parts)
                      </span>
                    )}
                    <span className="text-slate-600">{item.billingPolicy?.description}</span>
                  </div>
                </div>

                <button
                  className="button primary small-button text-xs"
                  onClick={() => handleCreateFromLookup(item)}
                >
                  <Plus size={14} /> Open Ticket for this Unit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tickets Queue Tabs */}
      <div className="status-tab-bar mb-4">
        {[
          ['ALL', 'All Complaints'],
          ['OPEN', 'Open & In-Progress'],
          ['RESOLVED', 'Resolved (Awaiting Customer Sign-off)'],
          ['CLOSED', 'Confirmed & Closed'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab-btn ${statusFilter === key ? 'active' : ''}`}
            onClick={() => setStatusFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Tickets Table */}
      <div className="panel">
        <div className="panel-head mb-3">
          <div>
            <h2>Service Tickets Desk</h2>
            <p>Every breakdown is tracked until the homeowner confirms everything works.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted p-6">Loading tickets…</p>
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">
            <LifeBuoy size={32} />
            <h3>No complaints in this queue</h3>
            <p>Customer service complaints and breakdown tickets appear here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket Ref</th>
                  <th>Customer</th>
                  <th>Issue Category</th>
                  <th>Fault Code</th>
                  <th>Coverage & Cost</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => (
                  <tr key={t.id} className="clickable-row" onClick={() => setSelectedTicket(t)}>
                    <td><strong>{t.number}</strong></td>
                    <td>
                      <div className="font-semibold">{t.customer?.name}</div>
                      <small className="muted">{t.customer?.phone}</small>
                    </td>
                    <td>
                      <span className="text-xs font-medium text-slate-700">{t.category?.replace('_', ' ')}</span>
                    </td>
                    <td>
                      {t.faultCode ? (
                        <span className="font-mono text-xs text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                          {t.faultCode}
                        </span>
                      ) : (
                        <span className="muted text-xs">—</span>
                      )}
                    </td>
                    <td>
                      {t.isUnderWarranty ? (
                        <span className="badge-green text-xs px-2 py-0.5 rounded font-semibold">
                          Free (₹0)
                        </span>
                      ) : (
                        <span className="badge-amber text-xs px-2 py-0.5 rounded font-semibold">
                          Billable
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`text-xs font-bold ${t.priority === 'CRITICAL' || t.priority === 'HIGH' ? 'text-red-700' : 'text-slate-600'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={t.status} size="small" />
                    </td>
                    <td>
                      <button className="button outline small-button">Review Ticket</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Detail Drawer / Modal */}
      {selectedTicket && (
        <Modal
          isOpen={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          title={`Support Ticket: ${selectedTicket.number}`}
          subtitle={`${selectedTicket.customer?.name} · ${selectedTicket.category?.replace('_', ' ')}`}
          maxWidth="750px"
        >
          <div className="ticket-modal-content">
            {/* Header Box */}
            <div className="p-3 bg-slate-50 rounded mb-3 flex justify-between items-center">
              <div>
                <span className="text-xs muted">Current Ticket Status:</span>
                <div className="mt-1"><StatusBadge status={selectedTicket.status} /></div>
              </div>
              <div className="text-right">
                <span className="text-xs muted">Warranty Status:</span>
                <div className="mt-1">
                  {selectedTicket.isUnderWarranty ? (
                    <span className="badge-green px-2 py-1 rounded text-xs font-bold">
                      Under Warranty — Free Repair (₹0)
                    </span>
                  ) : (
                    <span className="badge-amber px-2 py-1 rounded text-xs font-bold">
                      Billable Service (Labour + Parts)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="p-3 border rounded mb-3 text-sm">
              <div className="font-bold text-slate-800 mb-1">Breakdown Description:</div>
              <p className="text-slate-700 mb-2">{selectedTicket.description}</p>
              {selectedTicket.faultCode && (
                <div className="text-xs font-mono text-red-700 bg-red-50 p-2 rounded">
                  Fault Code Recorded: {selectedTicket.faultCode}
                </div>
              )}
            </div>

            {/* Equipment details */}
            {selectedTicket.serialUnit && (
              <div className="p-3 bg-slate-50 rounded mb-3 text-xs flex justify-between">
                <span>Equipment: <strong>{selectedTicket.serialUnit.product?.name}</strong></span>
                <span>Serial: <strong className="font-mono">{selectedTicket.serialUnit.serialNumber}</strong></span>
                <span>Project: {selectedTicket.project?.code || '—'}</span>
              </div>
            )}

            {/* Activity History */}
            <div className="activity-timeline-section mb-4">
              <strong className="text-xs uppercase text-slate-700 block mb-2 font-bold">
                Resolution Timeline
              </strong>
              <div className="space-y-1.5 text-xs">
                {selectedTicket.activities?.map((act) => (
                  <div key={act.id} className="p-2 bg-slate-50 rounded flex justify-between">
                    <div>
                      <strong>{act.type}:</strong> {act.message}
                    </div>
                    <small className="muted">{new Date(act.createdAt).toLocaleString('en-IN')}</small>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="ticket-actions mt-4 pt-3 border-t flex justify-end gap-2">
              {['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'REOPENED'].includes(selectedTicket.status) && (
                <button
                  className="button primary small-button"
                  onClick={() => setResolveModalOpen(true)}
                >
                  <Wrench size={15} /> Resolve Ticket & Log Hours
                </button>
              )}

              {selectedTicket.status === 'RESOLVED' && (
                <button
                  className="button primary small-button bg-emerald-600 text-white"
                  onClick={() => setConfirmModalOpen(true)}
                >
                  <CheckCircle2 size={15} /> Confirm Customer Sign-Off (Close Ticket)
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Create Ticket Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Customer Support Ticket"
        subtitle="Log a rainy season breakdown or customer complaint."
      >
        <form onSubmit={handleCreateTicketSubmit} className="survey-form">
          <label>
            Complaint Category
            <select
              value={createForm.category}
              onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
            >
              <option value="INVERTER_FAULT">Inverter Fault Code / Red Warning Light</option>
              <option value="NO_POWER">Zero Power Generation (Total Blackout)</option>
              <option value="BATTERY_ISSUE">Battery Backup Issue</option>
              <option value="LOW_GENERATION">Low Generation / Shading Concern</option>
              <option value="PHYSICAL_DAMAGE">Physical Storm / Water Damage</option>
              <option value="OTHER">Other Query</option>
            </select>
          </label>

          <div className="form-row">
            <label>
              Inverter Fault Code (if displayed)
              <input
                type="text"
                placeholder="e.g. ERR-04 or F-21"
                value={createForm.faultCode}
                onChange={(e) => setCreateForm({ ...createForm, faultCode: e.target.value })}
              />
            </label>

            <label>
              Priority
              <select
                value={createForm.priority}
                onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
              >
                <option value="CRITICAL">Critical (Zero Power)</option>
                <option value="HIGH">High (Inverter Fault)</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </label>
          </div>

          <label>
            Problem Description
            <textarea
              required
              rows="3"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="e.g. Customer states it is pouring rain and the inverter shows error code with no AC generation."
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Creating…' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Resolve Ticket Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Resolve Support Ticket & Bill Rates"
        subtitle={`Scene 5 Rule: Under warranty = ₹0 to customer. Expired = parts + labour billed.`}
      >
        <form onSubmit={handleResolveSubmit} className="survey-form">
          <label>
            Technician Labour Hours
            <input
              type="number"
              min="0"
              step="0.5"
              required
              value={resolveForm.labourHours}
              onChange={(e) => setResolveForm({ ...resolveForm, labourHours: e.target.value })}
            />
          </label>

          <div className="p-3 bg-slate-50 rounded text-xs space-y-1">
            <strong>Automated Billing Calculation:</strong>
            {selectedTicket?.isUnderWarranty ? (
              <div className="text-emerald-700 font-bold">
                ✓ Equipment is under warranty. The customer will be billed ₹0.
              </div>
            ) : (
              <div className="text-amber-900">
                • Standard labour rate: ₹350 / hour × {resolveForm.labourHours} hrs = ₹{Number(resolveForm.labourHours) * 350}
                <div>• Service visit inspection charge: ₹500</div>
                <div className="font-bold mt-1">Customer Invoice Total: ₹{Number(resolveForm.labourHours) * 350 + 500}</div>
              </div>
            )}
          </div>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setResolveModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Resolving…' : 'Complete Resolution'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Resolution Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Customer Resolution Sign-Off"
        subtitle="Scene 5: The complaint is tracked until the customer confirms that everything works."
      >
        <form onSubmit={handleConfirmSubmit} className="survey-form">
          <label>
            Customer Confirmation Note
            <textarea
              required
              rows="3"
              value={confirmNote}
              onChange={(e) => setConfirmNote(e.target.value)}
              placeholder="Customer confirmed power generation is fully restored."
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setConfirmModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button bg-emerald-600 text-white" disabled={busy}>
              {busy ? 'Closing…' : 'Officially Close Ticket'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

