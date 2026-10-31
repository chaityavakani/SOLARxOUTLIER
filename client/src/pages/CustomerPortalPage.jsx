import React, { useEffect, useState } from 'react';
import {
  Sun,
  ShieldCheck,
  CheckCircle2,
  Package,
  Clock,
  ArrowRight,
  CreditCard,
  LifeBuoy,
  Phone,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

export default function CustomerPortalPage({ user, onNavigate }) {
  const [requests, setRequests] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [quoteDetails, setQuoteDetails] = useState(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  // New Support Request Form
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    category: 'INVERTER_FAULT',
    faultCode: 'ERR-04',
    description: 'Inverter displaying fault code during rains with zero power.',
    priority: 'HIGH',
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPortalData();
  }, []);

  async function loadPortalData() {
    setLoading(true);
    try {
      const [reqRes, tktRes] = await Promise.all([
        api.get('/customers/me/requests'),
        api.get('/tickets'),
      ]);
      setRequests(reqRes.data.data || []);
      setTickets(tktRes.data.data || []);
    } catch (err) {
      setRequests([]);
      setTickets([]);
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
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptQuote() {
    if (!selectedQuote) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/quotes/${selectedQuote.id}/accept`);
      setQuoteModalOpen(false);
      loadPortalData();
      alert('Congratulations! You accepted the quotation. Your solar installation project is now created.');
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTicketSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api.post('/tickets', { ...ticketForm, source: 'PORTAL' });
      setTicketModalOpen(false);
      loadPortalData();
      alert('Your service request was submitted. Our team will contact you shortly.');
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmTicket(ticketId) {
    setBusy(true);
    try {
      await api.post(`/tickets/${ticketId}/confirm`, { note: 'Homeowner confirmed resolution via customer portal.' });
      loadPortalData();
      alert('Thank you for confirming the repair!');
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="customer-portal-page">
      {/* Welcome Card */}
      <div className="welcome-card mb-6">
        <div>
          <p className="eyebrow text-amber-400">HOMEOWNER PORTAL</p>
          <h2>Welcome, {user?.name || 'Customer'}.</h2>
          <p>
            Track your rooftop solar journey from quotation to 20-year warranty handover and service support.
          </p>
        </div>
        <div className="sun-orbit">
          <Sun size={48} />
        </div>
      </div>

      {/* Main Solar System Requests */}
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
            {requests.map((req) => (
              <div key={req.id} className="p-5 border rounded bg-slate-50/50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                      {req.code}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                      {req.requestedCapacityKw || 3} kW · {req.requestedSystemType?.replace('_', '-')} System
                    </h3>
                    <p className="text-xs muted">
                      Site Address: {req.city || req.address || 'Site details on file'}
                    </p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                {/* Progress Stepper */}
                <div className="portal-stepper grid grid-cols-4 gap-2 my-4 text-xs text-center">
                  <div className="step-box p-2 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                    <div>✓ 1. Enquiry</div>
                    <small>Received</small>
                  </div>

                  <div className={`step-box p-2 rounded font-semibold border ${req.surveys?.[0]?.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                    <div>{req.surveys?.[0]?.status === 'APPROVED' ? '✓' : '○'} 2. Roof Survey</div>
                    <small>{req.surveys?.[0]?.status === 'APPROVED' ? 'Feasibility Approved' : 'In Progress'}</small>
                  </div>

                  <div className={`step-box p-2 rounded font-semibold border ${req.quotes?.[0] ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                    <div>{req.quotes?.[0]?.status === 'ACCEPTED' ? '✓' : req.quotes?.[0] ? '★' : '○'} 3. Quotation</div>
                    <small>{req.quotes?.[0]?.status === 'ACCEPTED' ? 'Accepted' : req.quotes?.[0] ? 'Ready for Review' : 'Preparing'}</small>
                  </div>

                  <div className={`step-box p-2 rounded font-semibold border ${req.status === 'WON' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                    <div>{req.status === 'WON' ? '✓' : '○'} 4. Installation</div>
                    <small>{req.status === 'WON' ? 'Order Confirmed' : 'Pending Quote'}</small>
                  </div>
                </div>

                {/* Quotation Review Card (if quote is available) */}
                {req.quotes?.[0] && (
                  <div className="p-4 bg-white border border-amber-200 rounded mt-3 flex justify-between items-center shadow-sm">
                    <div>
                      <span className="text-xs uppercase text-amber-800 font-bold tracking-wider">
                        Quotation {req.quotes[0].number}
                      </span>
                      <h4 className="font-bold text-slate-900 mt-0.5">
                        Total Price: {money(req.quotes[0].total)}
                      </h4>
                      <p className="text-xs muted">
                        Status: <strong className="text-slate-800">{req.quotes[0].status}</strong>
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="button primary small-button"
                        onClick={() => openReviewQuote(req.quotes[0])}
                      >
                        <Package size={15} /> Review Itemized Parts & Accept
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support & Warranty Service Desk */}
      <div className="panel p-5">
        <div className="panel-head mb-4 flex justify-between items-center">
          <div>
            <h2>Service Requests & Breakdown Support</h2>
            <p>Report an issue (fault code, no power) or confirm completed repair visits.</p>
          </div>
          <button className="button primary small-button" onClick={() => setTicketModalOpen(true)}>
            <LifeBuoy size={15} /> Report Issue / Service Ticket
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={32} />
            <h3>No active service requests</h3>
            <p>Your solar system is operating normally. If you ever experience a fault, report it here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="p-4 border rounded bg-white flex justify-between items-center shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-bold text-slate-900">{t.number}</strong>
                    <StatusBadge status={t.status} size="small" />
                    {t.isUnderWarranty && (
                      <span className="badge-green text-xs px-2 py-0.5 rounded font-semibold">
                        Free Warranty (₹0)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{t.description}</p>
                  <small className="muted">Logged: {new Date(t.createdAt).toLocaleDateString('en-IN')}</small>
                </div>

                <div>
                  {t.status === 'RESOLVED' && (
                    <button
                      className="button primary small-button bg-emerald-600 text-white"
                      disabled={busy}
                      onClick={() => handleConfirmTicket(t.id)}
                    >
                      <CheckCircle2 size={14} /> Confirm Repair Done
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quote Review Modal */}
      {selectedQuote && (
        <Modal
          isOpen={quoteModalOpen}
          onClose={() => setQuoteModalOpen(false)}
          title={`Review Quotation: ${selectedQuote.number}`}
          subtitle="SunPower Solutions Ready Kit Assembly"
          maxWidth="750px"
        >
          {quoteDetails && (
            <div className="quote-review-body">
              {message && <p className="form-message error mb-3">{message}</p>}

              <div className="p-3 bg-slate-50 rounded mb-3 flex justify-between items-center">
                <div>
                  <strong>{Number(quoteDetails.capacityKw)} kW · {quoteDetails.systemType?.replace('_', '-')} System</strong>
                </div>
                <div className="text-xl font-bold text-emerald-800">
                  {money(quoteDetails.total)}
                </div>
              </div>

              {/* Items List */}
              <div className="table-wrap mb-4">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>Component Description</th>
                      <th>Quantity</th>
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteDetails.items?.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.description}</strong>
                          {item.product?.isSerialized && (
                            <small className="badge-blue ml-2 px-1 py-0.2 rounded text-[10px]">
                              Serial Tracked
                            </small>
                          )}
                        </td>
                        <td>{Number(item.quantity)} {item.product?.unit || 'PCS'}</td>
                        <td><strong>{money(item.lineTotal)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Warranty Coverage Notice */}
              <div className="p-3 bg-emerald-50 text-emerald-900 rounded text-xs space-y-1 mb-4">
                <strong>Included Warranties with this Package:</strong>
                <div>• Solar Panels: 20 Years Performance Warranty</div>
                <div>• Inverters & Batteries: 2 Years Full Replacement Warranty</div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  className="button outline small-button"
                  onClick={() => setQuoteModalOpen(false)}
                >
                  Close
                </button>
                {selectedQuote.status === 'SENT' && (
                  <button
                    type="button"
                    className="button primary small-button bg-emerald-600 text-white"
                    disabled={busy}
                    onClick={handleAcceptQuote}
                  >
                    <Check size={15} /> {busy ? 'Accepting…' : 'Accept Quote & Place Order'}
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* New Service Ticket Modal */}
      <Modal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Report System Issue / Service Request"
        subtitle="Our support crew will respond immediately to inspect and resolve your issue."
      >
        <form onSubmit={handleCreateTicketSubmit} className="survey-form">
          <label>
            Issue Category
            <select
              value={ticketForm.category}
              onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
            >
              <option value="INVERTER_FAULT">Inverter Error Code / Red Light</option>
              <option value="NO_POWER">Zero Power Generation (Blackout)</option>
              <option value="BATTERY_ISSUE">Battery Not Charging</option>
              <option value="LOW_GENERATION">Lower Generation than Normal</option>
              <option value="PHYSICAL_DAMAGE">Storm / Physical Damage</option>
              <option value="OTHER">Other Technical Query</option>
            </select>
          </label>

          <label>
            Inverter Error Code (if visible on screen)
            <input
              type="text"
              placeholder="e.g. ERR-04 or F-21"
              value={ticketForm.faultCode}
              onChange={(e) => setTicketForm({ ...ticketForm, faultCode: e.target.value })}
            />
          </label>

          <label>
            Description of the Problem
            <textarea
              required
              rows="3"
              value={ticketForm.description}
              onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
              placeholder="Describe what happened, weather conditions, or what you observe on the display."
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setTicketModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit Service Ticket'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

