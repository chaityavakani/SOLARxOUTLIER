import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  Printer,
  Zap,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

export default function QuotesPage({ onNavigate }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [quoteDetailLoading, setQuoteDetailLoading] = useState(false);

  // Create Quote modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [approvedLeads, setApprovedLeads] = useState([]);
  const [kitTemplates, setKitTemplates] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedKitId, setSelectedKitId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Print view mode
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    setLoading(true);
    try {
      const res = await api.get('/quotes');
      setQuotes(res.data.data || []);
    } catch (err) {
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }

  async function openCreateModal() {
    setBusy(true);
    setMessage('');
    try {
      const [leadsRes, kitsRes] = await Promise.all([
        api.get('/leads?status=SURVEY_APPROVED'),
        api.get('/kit-templates'),
      ]);
      const leads = leadsRes.data.data || [];
      const kits = kitsRes.data.data || [];
      setApprovedLeads(leads);
      setKitTemplates(kits);
      setSelectedLeadId(leads[0]?.id || '');
      setSelectedKitId(kits[0]?.id || '');
      setCreateModalOpen(true);
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateQuote(e) {
    e.preventDefault();
    setMessage('');
    if (!selectedLeadId) return setMessage('Please select an approved enquiry.');
    if (!selectedKitId) return setMessage('Please select a system kit template.');
    setBusy(true);
    setMessage('');
    try {
      await api.post('/quotes', {
        leadId: selectedLeadId,
        kitTemplateId: selectedKitId,
      });
      setCreateModalOpen(false);
      loadQuotes();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function openQuote(id) {
    setQuoteDetailLoading(true);
    setMessage('');
    try {
      const res = await api.get(`/quotes/${id}`);
      setSelectedQuote(res.data.data);
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setQuoteDetailLoading(false);
    }
  }

  async function handleSendQuote(quoteId) {
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/quotes/${quoteId}/send`);
      openQuote(quoteId);
      loadQuotes();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptQuote(quoteId) {
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/quotes/${quoteId}/accept`);
      openQuote(quoteId);
      loadQuotes();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="quotes-page">
      {/* Top Banner */}
      <div className="welcome-card mb-4">
        <div>
          <p className="eyebrow text-amber-400">READY KITS & BILL OF MATERIALS (SCENE 2)</p>
          <h2>Quotations & Automated Kit Assembly</h2>
          <p>
            Choose a capacity template (1 kW to 5 kW, On-Grid or Off-Grid). The exact parts list follows automatically.
          </p>
        </div>
        <button className="button primary small-button" onClick={openCreateModal} disabled={busy}>
          <Plus size={16} /> Generate Quote from Kit
        </button>
      </div>

      {/* Main Quotes List */}
      <div className="panel">
        <div className="panel-head mb-3">
          <div>
            <h2>Prepared Quotations</h2>
            <p>Every small part is accounted for: panels, inverter, stands, switches, wires, earthing, and battery.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted p-6">Loading quotations…</p>
        ) : quotes.length === 0 ? (
          <div className="empty-state">
            <Package size={32} />
            <h3>No quotes prepared yet</h3>
            <p>Approve a roof survey first, then click "Generate Quote from Kit".</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quote Number</th>
                  <th>Customer</th>
                  <th>Capacity & Type</th>
                  <th>Subtotal</th>
                  <th>Tax</th>
                  <th>Total Price</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="clickable-row" onClick={() => openQuote(q.id)}>
                    <td><strong>{q.number}</strong></td>
                    <td>
                      <div className="font-semibold">{q.customer?.name}</div>
                      <small className="muted">{q.customer?.phone}</small>
                    </td>
                    <td>
                      {Number(q.capacityKw)} kW · {q.systemType.replace('_', '-')}
                    </td>
                    <td>{money(q.subtotal)}</td>
                    <td>{money(q.taxTotal)}</td>
                    <td><strong className="text-emerald-700">{money(q.total)}</strong></td>
                    <td>
                      <StatusBadge status={q.status} size="small" />
                    </td>
                    <td>
                      <button className="button outline small-button">Review BOM</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quote Detail & BOM Drawer / Modal */}
      {selectedQuote && (
        <Modal
          isOpen={Boolean(selectedQuote)}
          onClose={() => setSelectedQuote(null)}
          title={`Quotation: ${selectedQuote.number}`}
          subtitle={`${selectedQuote.customer?.name} · ${Number(selectedQuote.capacityKw)} kW ${selectedQuote.systemType.replace('_', '-')} System`}
          maxWidth="850px"
        >
          {quoteDetailLoading ? (
            <p className="muted p-4">Loading BOM details…</p>
          ) : (
            <div className="quote-modal-content">
              {message && <p className="form-message error mb-3">{message}</p>}

              {/* Status Header */}
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded mb-4">
                <div>
                  <span className="text-xs muted">Quote Status:</span>
                  <div className="mt-0.5"><StatusBadge status={selectedQuote.status} /></div>
                </div>
                <div className="text-right">
                  <span className="text-xs muted">Quotation Total:</span>
                  <div className="text-2xl font-bold text-emerald-800">{money(selectedQuote.total)}</div>
                </div>
              </div>

              {/* Bill of Materials (BOM) Table */}
              <div className="bom-table-section mb-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Itemized Bill of Materials (BOM)
                </h4>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Component Description</th>
                        <th>Category</th>
                        <th>Qty</th>
                        <th>Unit Rate</th>
                        <th>Tax %</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedQuote.items?.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.description}</strong>
                            {item.product?.isSerialized && (
                              <small className="badge-blue ml-2 px-1.5 py-0.5 rounded text-[10px]">
                                Serial Tracked
                              </small>
                            )}
                          </td>
                          <td><small className="muted">{item.product?.category || 'Hardware'}</small></td>
                          <td>{Number(item.quantity)} {item.product?.unit || 'PCS'}</td>
                          <td>{money(item.unitPrice)}</td>
                          <td>{item.taxPercent}%</td>
                          <td><strong>{money(item.lineTotal)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Price Calculation Summary */}
              <div className="price-summary-box p-4 bg-slate-50 rounded flex justify-end">
                <div className="w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="muted">Hardware & Labour Subtotal:</span>
                    <strong>{money(selectedQuote.subtotal)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="muted">GST (18%):</span>
                    <strong>{money(selectedQuote.taxTotal)}</strong>
                  </div>
                  {Number(selectedQuote.discount) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount / Subsidy Deduction:</span>
                      <strong>-{money(selectedQuote.discount)}</strong>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t pt-2">
                    <span>Payable Total:</span>
                    <strong className="text-emerald-800">{money(selectedQuote.total)}</strong>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="quote-actions mt-4 pt-3 border-t flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="button outline small-button"
                    onClick={() => window.print()}
                  >
                    <Printer size={15} /> Print View
                  </button>
                  <a
                    href={`http://localhost:5000/api/v1/quotes/${selectedQuote.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="button outline small-button inline-flex items-center gap-1"
                  >
                    <FileText size={15} /> Official PDF
                  </a>
                </div>

                <div className="flex gap-2">
                  {selectedQuote.status === 'DRAFT' && (
                    <button
                      className="button primary small-button"
                      disabled={busy}
                      onClick={() => handleSendQuote(selectedQuote.id)}
                    >
                      <Send size={15} /> Send to Customer Portal
                    </button>
                  )}

                  {selectedQuote.status === 'SENT' && (
                    <button
                      className="button primary small-button bg-emerald-600 text-white"
                      disabled={busy}
                      onClick={() => handleAcceptQuote(selectedQuote.id)}
                    >
                      <Check size={15} /> Customer Accepts Quote (Confirm Project)
                    </button>
                  )}

                  {selectedQuote.status === 'ACCEPTED' && (
                    <button
                      className="button outline small-button"
                      onClick={() => { setSelectedQuote(null); onNavigate('projects'); }}
                    >
                      <ArrowRight size={15} /> Go to Project & Advance Payment
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Generate Quote from Kit Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Generate Quotation from Ready Kit Template"
        subtitle="Select an approved enquiry and system capacity. All BOM lines are generated automatically."
      >
        <form onSubmit={handleCreateQuote} className="survey-form">
          {message && <p className="form-message error">{message}</p>}

          <label>
            Approved Feasibility Enquiry
            {approvedLeads.length === 0 ? (
              <p className="text-sm text-red-600 p-2 bg-red-50 rounded">
                No leads currently have an approved roof survey. Approve a survey in the Surveys workspace first.
              </p>
            ) : (
              <select
                required
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
              >
                {approvedLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.code} · {lead.name} · {lead.city} ({lead.requestedCapacityKw || 3} kW)
                  </option>
                ))}
              </select>
            )}
          </label>

          <label>
            System Package & Capacity Template
            <select
              required
              value={selectedKitId}
              onChange={(e) => setSelectedKitId(e.target.value)}
            >
              {kitTemplates.map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.name} — {Number(kit.capacityKw)} kW {kit.systemType.replace('_', '-')} ({kit.items?.length || 7} parts)
                </option>
              ))}
            </select>
          </label>

          <div className="p-3 bg-amber-50 rounded text-xs text-amber-900 mt-2">
            <strong>Automated BOM:</strong> Solar panels, inverters, metal mounting stands, DC protection boxes, cables, earthing kit, and batteries (if off-grid) will be generated automatically without typing by hand.
          </div>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="button primary small-button"
              disabled={busy || approvedLeads.length === 0}
            >
              {busy ? 'Building BOM…' : 'Generate Quotation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
