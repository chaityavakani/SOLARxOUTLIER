import React, { useEffect, useState } from 'react';
import {
  Sun, ShieldCheck, CheckCircle2, Package, LifeBuoy, Check, IndianRupee, Wallet,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import RazorpayCheckout from '../components/RazorpayCheckout.jsx';

const EMPTY_PAY = { amount: '', type: 'ADVANCE', mode: 'UPI', reference: '', proofNote: '' };

export default function CustomerPortalPage({ user, onNavigate }) {
  const [requests, setRequests] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [paymentsByProject, setPaymentsByProject] = useState({});
  const [loading, setLoading] = useState(true);

  // Quote modal
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [quoteDetails, setQuoteDetails] = useState(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  // Pay modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payProjectId, setPayProjectId] = useState(null);
  const [payQuoteTotal, setPayQuoteTotal] = useState(0);
  const [payForm, setPayForm] = useState(EMPTY_PAY);
  const [payError, setPayError] = useState('');

  // Razorpay checkout
  const [rzpOpen, setRzpOpen] = useState(false);
  const [rzpProjectId, setRzpProjectId] = useState(null);
  const [rzpQuoteTotal, setRzpQuoteTotal] = useState(0);

  // Ticket modal
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    category: 'INVERTER_FAULT', faultCode: '', description: '', priority: 'HIGH',
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadPortalData(); }, []);

  async function loadPortalData() {
    setLoading(true);
    try {
      const [reqRes, tktRes] = await Promise.all([
        api.get('/customers/me/requests'),
        api.get('/tickets'),
      ]);
      const reqs = reqRes.data.data || [];
      setRequests(reqs);
      setTickets(tktRes.data.data || []);

      // Load payments for each project
      const projectIds = reqs
        .flatMap((r) => r.quotes || [])
        .map((q) => q.project?.id)
        .filter(Boolean);
      if (projectIds.length) {
        const results = await Promise.allSettled(projectIds.map((pid) => api.get(`/payments/${pid}`)));
        const map = {};
        projectIds.forEach((pid, i) => {
          if (results[i].status === 'fulfilled') map[pid] = results[i].value.data.data || [];
        });
        setPaymentsByProject(map);
      }
    } catch {
      setRequests([]); setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  async function openReviewQuote(quote) {
    setSelectedQuote(quote);
    setBusy(true);
    setMessage('');
    try {
      const res = await api.get(`/quotes/${quote.id}`);
      setQuoteDetails(res.data.data);
      setQuoteModalOpen(true);
    } catch (err) { alert(errorText(err)); }
    finally { setBusy(false); }
  }

  async function handleAcceptQuote() {
    if (!selectedQuote) return;
    setBusy(true); setMessage('');
    try {
      await api.post(`/quotes/${selectedQuote.id}/accept`);
      setQuoteModalOpen(false);
      loadPortalData();
      alert('Congratulations! You accepted the quotation. Your solar project is now active.');
    } catch (err) { setMessage(errorText(err)); }
    finally { setBusy(false); }
  }

  function openPayModal(projectId, quoteTotal) {
    setPayProjectId(projectId);
    setPayQuoteTotal(quoteTotal);
    setPayForm(EMPTY_PAY);
    setPayError('');
    setPayModalOpen(true);
  }

  async function handleSubmitPayment(e) {
    e.preventDefault();
    if (!payForm.amount || Number(payForm.amount) <= 0) {
      setPayError('Enter a valid payment amount.'); return;
    }
    setBusy(true); setPayError('');
    try {
      await api.post('/payments/submit', {
        projectId: payProjectId,
        amount: Number(payForm.amount),
        type: payForm.type,
        mode: payForm.mode,
        reference: payForm.reference || undefined,
        proofNote: payForm.proofNote || undefined,
      });
      setPayModalOpen(false);
      loadPortalData();
    } catch (err) { setPayError(errorText(err)); }
    finally { setBusy(false); }
  }

  function openRazorpay(projectId, quoteTotal) {
    setRzpProjectId(projectId);
    setRzpQuoteTotal(quoteTotal);
    setRzpOpen(true);
  }

  async function handleCreateTicketSubmit(e) {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      await api.post('/tickets', { ...ticketForm, source: 'PORTAL' });
      setTicketModalOpen(false);
      loadPortalData();
      alert('Your service request was submitted. Our team will contact you shortly.');
    } catch (err) { setMessage(errorText(err)); }
    finally { setBusy(false); }
  }

  async function handleConfirmTicket(ticketId) {
    setBusy(true);
    try {
      await api.post(`/tickets/${ticketId}/confirm`, { note: 'Homeowner confirmed resolution via customer portal.' });
      loadPortalData();
      alert('Thank you for confirming the repair!');
    } catch (err) { alert(errorText(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="customer-portal-page">
      {/* Welcome Card */}
      <div className="welcome-card mb-6">
        <div>
          <p className="eyebrow text-amber-400">HOMEOWNER PORTAL</p>
          <h2>Welcome, {user?.name || 'Customer'}.</h2>
          <p>Track your rooftop solar journey from quotation to 20-year warranty handover and service support.</p>
        </div>
        <div className="sun-orbit"><Sun size={48} /></div>
      </div>

      {/* Solar Journey */}
      <div className="panel p-5 mb-6">
        <div className="panel-head mb-4">
          <div>
            <h2>My Solar System & Installation Journey</h2>
            <p>Real-time progress of your enquiry, site survey, quotation, and installation.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted p-4">Loading your system details…</p>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <Sun size={32} />
            <h3>No linked solar project yet</h3>
            <p>If you recently submitted an enquiry, please ensure your registered phone matches the enquiry phone.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const project = req.quotes?.[0]?.project;
              const payments = project ? (paymentsByProject[project.id] || []) : [];
              const quoteTotal = Number(req.quotes?.[0]?.total || 0);
              const verified = payments.filter((p) => p.status === 'VERIFIED').reduce((s, p) => s + Number(p.amount), 0);
              const pending = payments.filter((p) => p.status === 'PENDING_VERIFICATION').reduce((s, p) => s + Number(p.amount), 0);
              const balance = Math.max(0, quoteTotal - verified);

              return (
                <div key={req.id} className="p-5 border rounded bg-slate-50/50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">{req.code}</span>
                      <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                        {req.requestedCapacityKw || 3} kW · {req.requestedSystemType?.replace('_', '-')} System
                      </h3>
                      <p className="text-xs muted">Site Address: {req.city || req.address || 'Site details on file'}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Progress Stepper */}
                  <div className="portal-stepper grid grid-cols-4 gap-2 my-4 text-xs text-center">
                    <div className="step-box p-2 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                      <div>✓ 1. Enquiry</div><small>Received</small>
                    </div>
                    <div className={`step-box p-2 rounded font-semibold border ${req.surveys?.[0]?.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                      <div>{req.surveys?.[0]?.status === 'APPROVED' ? '✓' : '○'} 2. Roof Survey</div>
                      <small>{req.surveys?.[0]?.status === 'APPROVED' ? 'Approved' : 'In Progress'}</small>
                    </div>
                    <div className={`step-box p-2 rounded font-semibold border ${req.quotes?.[0] ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                      <div>{req.quotes?.[0]?.status === 'ACCEPTED' ? '✓' : req.quotes?.[0] ? '★' : '○'} 3. Quotation</div>
                      <small>{req.quotes?.[0]?.status === 'ACCEPTED' ? 'Accepted' : req.quotes?.[0] ? 'Ready for Review' : 'Preparing'}</small>
                    </div>
                    <div className={`step-box p-2 rounded font-semibold border ${req.status === 'WON' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                      <div>{req.status === 'WON' ? '✓' : '○'} 4. Installation</div>
                      <small>{req.status === 'WON' ? 'Order Confirmed' : 'Pending'}</small>
                    </div>
                  </div>

                  {/* Quote card */}
                  {req.quotes?.[0] && (
                    <div className="p-4 bg-white border border-amber-200 rounded mt-3 flex justify-between items-center shadow-sm">
                      <div>
                        <span className="text-xs uppercase text-amber-800 font-bold tracking-wider">Quotation {req.quotes[0].number}</span>
                        <h4 className="font-bold text-slate-900 mt-0.5">Total Price: {money(req.quotes[0].total)}</h4>
                        <p className="text-xs muted">Status: <strong className="text-slate-800">{req.quotes[0].status}</strong></p>
                      </div>
                      <button className="button primary small-button" onClick={() => openReviewQuote(req.quotes[0])}>
                        <Package size={15} /> Review & Accept
                      </button>
                    </div>
                  )}

                  {/* Payment section — shown once project exists */}
                  {project && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="text-xs font-bold text-blue-800 uppercase tracking-wide flex items-center gap-1">
                            <Wallet size={13} /> Payment & Finance
                          </span>
                          <p className="text-xs text-blue-600 mt-0.5">Project: {project.code}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            className="button primary small-button"
                            style={{ background: '#072654', color: '#fff', display:'flex', alignItems:'center', gap:5 }}
                            onClick={() => openRazorpay(project.id, quoteTotal)}
                          >
                            <span style={{background:'#fff',color:'#072654',borderRadius:3,padding:'0 4px',fontWeight:900,fontSize:11,letterSpacing:'-0.5px'}}>R⚡</span>
                            Pay via Razorpay
                          </button>
                          <button
                            className="button outline small-button"
                            onClick={() => openPayModal(project.id, quoteTotal)}
                          >
                            <IndianRupee size={14} /> Manual Entry
                          </button>
                        </div>
                      </div>

                      {/* Finance summary tiles */}
                      <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                        <div className="p-2 bg-white rounded border border-blue-100">
                          <div className="text-slate-500">Total Quoted</div>
                          <div className="font-bold text-slate-900">{money(quoteTotal)}</div>
                        </div>
                        <div className="p-2 bg-white rounded border border-emerald-100">
                          <div className="text-emerald-600">Verified Paid</div>
                          <div className="font-bold text-emerald-700">{money(verified)}</div>
                        </div>
                        <div className="p-2 bg-white rounded border border-slate-100">
                          <div className="text-slate-500">Balance Due</div>
                          <div className="font-bold text-slate-900">{money(balance)}</div>
                        </div>
                      </div>

                      {pending > 0 && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 mb-2">
                          ⏳ {money(pending)} submitted — awaiting verification by our Sales team.
                        </div>
                      )}

                      {/* Payment history */}
                      {payments.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {payments.map((p) => (
                            <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-white rounded border">
                              <div>
                                <span className="font-semibold">{money(p.amount)}</span>
                                <span className="text-slate-400 ml-2">{p.type} · {p.mode}</span>
                                {p.reference && <span className="text-slate-400 ml-1">({p.reference})</span>}
                                <span className="text-slate-300 ml-2">{new Date(p.createdAt).toLocaleDateString('en-IN')}</span>
                              </div>
                              <div>
                                {p.status === 'VERIFIED' && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">✓ Received</span>}
                                {p.status === 'PENDING_VERIFICATION' && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">⏳ Pending</span>}
                                {p.status === 'REJECTED' && <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold" title={p.rejectionReason}>✗ Not Verified</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {payments.length === 0 && (
                        <p className="text-xs text-blue-600 text-center py-2">No payments submitted yet. Click "Make a Payment" to get started.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Support Desk */}
      <div className="panel p-5">
        <div className="panel-head mb-4 flex justify-between items-center">
          <div>
            <h2>Service Requests & Breakdown Support</h2>
            <p>Report an issue or confirm completed repair visits.</p>
          </div>
          <button className="button primary small-button" onClick={() => setTicketModalOpen(true)}>
            <LifeBuoy size={15} /> Report Issue
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={32} />
            <h3>No active service requests</h3>
            <p>Your solar system is operating normally.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="p-4 border rounded bg-white flex justify-between items-center shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-bold text-slate-900">{t.number}</strong>
                    <StatusBadge status={t.status} size="small" />
                    {t.isUnderWarranty && <span className="badge-green text-xs px-2 py-0.5 rounded font-semibold">Free Warranty (₹0)</span>}
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{t.description}</p>
                  <small className="muted">Logged: {new Date(t.createdAt).toLocaleDateString('en-IN')}</small>
                </div>
                <div>
                  {t.status === 'RESOLVED' && (
                    <button className="button primary small-button bg-emerald-600 text-white" disabled={busy} onClick={() => handleConfirmTicket(t.id)}>
                      <CheckCircle2 size={14} /> Confirm Repair Done
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Real Razorpay Checkout ─── */}
      {rzpOpen && (
        <RazorpayCheckout
          projectId={rzpProjectId}
          quoteTotal={rzpQuoteTotal}
          customerName={user?.name}
          customerEmail={user?.email}
          customerPhone={user?.phone}
          onSuccess={() => { loadPortalData(); }}
          onClose={() => setRzpOpen(false)}
        />
      )}

      {/* Payment Submission Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Submit Your Payment"
        subtitle="Our Sales team will verify and confirm receipt. Only verified payments count toward your balance."
      >
        <form onSubmit={handleSubmitPayment} className="survey-form">
          {payError && <p className="form-message error mb-3">{payError}</p>}

          <label>
            Amount (₹) *
            <input
              type="number" min="1" step="0.01" required
              placeholder={`e.g. ${Math.round(payQuoteTotal * 0.3).toLocaleString('en-IN')} (30% advance)`}
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              Payment Type
              <select value={payForm.type} onChange={(e) => setPayForm({ ...payForm, type: e.target.value })}>
                <option value="ADVANCE">Advance / Booking Amount</option>
                <option value="PARTIAL">Partial Payment</option>
                <option value="FINAL">Final Payment</option>
                <option value="SERVICE">Service Payment</option>
              </select>
            </label>
            <label>
              Payment Mode
              <select value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Card</option>
                <option value="RAZORPAY">Razorpay</option>
              </select>
            </label>
          </div>

          <label>
            Transaction Reference / UTR Number
            <input
              type="text"
              placeholder="e.g. UPI ref no., NEFT UTR, Cheque No."
              value={payForm.reference}
              onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
            />
          </label>

          <label>
            Additional Note (optional)
            <textarea
              rows="2"
              placeholder="e.g. Paid via HDFC UPI at 3:45 PM on 1 Nov 2026"
              value={payForm.proofNote}
              onChange={(e) => setPayForm({ ...payForm, proofNote: e.target.value })}
            />
          </label>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <strong>Note:</strong> After you submit, our Sales team will verify and mark it as received. You will see the status update here.
          </div>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setPayModalOpen(false)}>Cancel</button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              <IndianRupee size={14} /> {busy ? 'Submitting…' : 'Submit Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quote Review Modal */}
      {selectedQuote && (
        <Modal
          isOpen={quoteModalOpen}
          onClose={() => setQuoteModalOpen(false)}
          title={`Review Quotation: ${selectedQuote.number}`}
          subtitle="Review all components before accepting."
          maxWidth="750px"
        >
          {quoteDetails && (
            <div className="quote-review-body">
              {message && <p className="form-message error mb-3">{message}</p>}
              <div className="p-3 bg-slate-50 rounded mb-3 flex justify-between items-center">
                <strong>{Number(quoteDetails.capacityKw)} kW · {quoteDetails.systemType?.replace('_', '-')} System</strong>
                <div className="text-xl font-bold text-emerald-800">{money(quoteDetails.total)}</div>
              </div>
              <div className="table-wrap mb-4">
                <table className="data-table text-xs">
                  <thead><tr><th>Component</th><th>Qty</th><th>Line Total</th></tr></thead>
                  <tbody>
                    {quoteDetails.items?.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.description}</strong></td>
                        <td>{Number(item.quantity)} {item.product?.unit || 'PCS'}</td>
                        <td><strong>{money(item.lineTotal)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-900 rounded text-xs mb-4">
                <strong>Included Warranties:</strong>
                <div>• Solar Panels: 20 Years Performance Warranty</div>
                <div>• Inverters & Batteries: 2 Years Full Replacement</div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" className="button outline small-button" onClick={() => setQuoteModalOpen(false)}>Close</button>
                {selectedQuote.status === 'SENT' && (
                  <button type="button" className="button primary small-button bg-emerald-600 text-white" disabled={busy} onClick={handleAcceptQuote}>
                    <Check size={15} /> {busy ? 'Accepting…' : 'Accept Quote & Place Order'}
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Service Ticket Modal */}
      <Modal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Report System Issue / Service Request"
        subtitle="Our support crew will respond immediately."
      >
        <form onSubmit={handleCreateTicketSubmit} className="survey-form">
          <label>
            Issue Category
            <select value={ticketForm.category} onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}>
              <option value="INVERTER_FAULT">Inverter Error Code / Red Light</option>
              <option value="NO_POWER">Zero Power Generation (Blackout)</option>
              <option value="BATTERY_ISSUE">Battery Not Charging</option>
              <option value="LOW_GENERATION">Lower Generation than Normal</option>
              <option value="PHYSICAL_DAMAGE">Storm / Physical Damage</option>
              <option value="OTHER">Other Technical Query</option>
            </select>
          </label>
          <label>
            Error Code (if shown on display)
            <input type="text" placeholder="e.g. ERR-04 or F-21" value={ticketForm.faultCode} onChange={(e) => setTicketForm({ ...ticketForm, faultCode: e.target.value })} />
          </label>
          <label>
            Description *
            <textarea required rows="3" value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} placeholder="Describe what happened, weather conditions, what you see on the display." />
          </label>
          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setTicketModalOpen(false)}>Cancel</button>
            <button type="submit" className="button primary small-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit Service Ticket'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
