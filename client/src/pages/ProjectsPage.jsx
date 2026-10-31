import React, { useEffect, useState } from 'react';
import {
  Home,
  CheckCircle2,
  Clock,
  Truck,
  Wrench,
  DollarSign,
  FileText,
  CreditCard,
  Plus,
  ArrowRight,
  ShieldCheck,
  Landmark,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

export default function ProjectsPage({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetailLoading, setProjectDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    type: 'ADVANCE',
    mode: 'UPI',
    reference: '',
  });

  // Subsidy Paperwork Modal
  const [subsidyModalOpen, setSubsidyModalOpen] = useState(false);
  const [subsidyForm, setSubsidyForm] = useState({
    status: 'NOT_STARTED',
    applicationRef: '',
    amountExpected: 78000,
    amountReceived: 0,
    remarks: '',
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProjects();
  }, [statusFilter]);

  async function loadProjects() {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await api.get('/projects', { params });
      setProjects(res.data.data || []);
    } catch (err) {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  async function openProject(id) {
    setProjectDetailLoading(true);
    setMessage('');
    try {
      const res = await api.get(`/projects/${id}`);
      setSelectedProject(res.data.data);
      // Prepopulate subsidy form
      const sub = res.data.data.subsidy;
      setSubsidyForm({
        status: sub?.status || 'NOT_STARTED',
        applicationRef: sub?.applicationRef || '',
        amountExpected: Number(sub?.amountExpected) || Math.min(78000, Number(res.data.data.capacityKw) * 18000),
        amountReceived: Number(sub?.amountReceived) || 0,
        remarks: sub?.remarks || '',
      });
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setProjectDetailLoading(false);
    }
  }

  function openPaymentModal(type = 'ADVANCE') {
    if (!selectedProject) return;
    const paid = (selectedProject.payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const total = Number(selectedProject.quote?.total || 0);
    const balance = Math.max(0, total - paid);
    const defaultAmount = type === 'ADVANCE' ? Math.ceil(total * 0.3) : balance;

    setPaymentForm({
      amount: String(defaultAmount),
      type,
      mode: 'UPI',
      reference: '',
    });
    setPaymentModalOpen(true);
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!selectedProject) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post('/payments', {
        projectId: selectedProject.id,
        amount: Number(paymentForm.amount),
        type: paymentForm.type,
        mode: paymentForm.mode,
        reference: paymentForm.reference,
      });
      setPaymentModalOpen(false);
      openProject(selectedProject.id);
      loadProjects();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmProject() {
    if (!selectedProject) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/projects/${selectedProject.id}/confirm`);
      openProject(selectedProject.id);
      loadProjects();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseProject() {
    if (!selectedProject) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/projects/${selectedProject.id}/close`);
      openProject(selectedProject.id);
      loadProjects();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubsidySubmit(e) {
    e.preventDefault();
    if (!selectedProject) return;
    setBusy(true);
    setMessage('');
    try {
      await api.put(`/projects/${selectedProject.id}/subsidy`, {
        status: subsidyForm.status,
        applicationRef: subsidyForm.applicationRef,
        amountExpected: Number(subsidyForm.amountExpected),
        amountReceived: Number(subsidyForm.amountReceived),
        remarks: subsidyForm.remarks,
      });
      setSubsidyModalOpen(false);
      openProject(selectedProject.id);
      loadProjects();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="projects-page">
      {/* Header Banner */}
      <div className="welcome-card mb-4">
        <div>
          <p className="eyebrow text-amber-400">ORDER CONFIRMATION & ADVANCE PAYMENTS (SCENE 2 & 3)</p>
          <h2>Project Installations & Orders</h2>
          <p>
            Collecting the advance triggers the warehouse pick list and places the installation crew on the schedule.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="status-tab-bar mb-4">
        {[
          ['ALL', 'All Projects'],
          ['AWAITING_ADVANCE', 'Awaiting Advance'],
          ['CONFIRMED', 'Confirmed Orders'],
          ['DISPATCHED', 'In Transit'],
          ['INSTALLED', 'Installed & Tested'],
          ['CLOSED', 'Settled & Closed'],
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

      {/* Projects Table */}
      <div className="panel">
        <div className="panel-head mb-3">
          <div>
            <h2>Active Solar Projects</h2>
            <p>From accepted quotes to advance payments, dispatch, installation, and closure.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted p-6">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <Home size={32} />
            <h3>No projects found</h3>
            <p>Projects are created automatically when quotes are accepted by customers.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project Code</th>
                  <th>Customer</th>
                  <th>System</th>
                  <th>Quoted Total</th>
                  <th>Dispatch Status</th>
                  <th>Installation</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="clickable-row" onClick={() => openProject(p.id)}>
                    <td><strong>{p.code}</strong></td>
                    <td>
                      <div className="font-semibold">{p.customer?.name}</div>
                      <small className="muted">{p.customer?.phone}</small>
                    </td>
                    <td>{Number(p.capacityKw)} kW · {p.systemType.replace('_', '-')}</td>
                    <td><strong>{money(p.quote?.total)}</strong></td>
                    <td>
                      {p.dispatch ? (
                        <StatusBadge status={p.dispatch.status} size="small" />
                      ) : (
                        <small className="muted">Awaiting Confirm</small>
                      )}
                    </td>
                    <td>
                      {p.installation ? (
                        <StatusBadge status={p.installation.status} size="small" />
                      ) : (
                        <small className="muted">Unscheduled</small>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={p.status} size="small" />
                    </td>
                    <td>
                      <button className="button outline small-button">Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Project Details Modal */}
      {selectedProject && (
        <Modal
          isOpen={Boolean(selectedProject)}
          onClose={() => setSelectedProject(null)}
          title={`Project Management: ${selectedProject.code}`}
          subtitle={`${selectedProject.customer?.name} · ${Number(selectedProject.capacityKw)} kW ${selectedProject.systemType.replace('_', '-')}`}
          maxWidth="850px"
        >
          {projectDetailLoading ? (
            <p className="muted p-4">Loading project details…</p>
          ) : (
            <div className="project-modal-content">
              {message && <p className="form-message error mb-3">{message}</p>}

              {/* Financial Status Summary */}
              {(() => {
                const total = Number(selectedProject.quote?.total || 0);
                const paid = (selectedProject.payments || []).reduce((s, p) => s + Number(p.amount), 0);
                const balance = Math.max(0, total - paid);
                const advanceRequired = Math.ceil(total * 0.3);
                const canConfirm = selectedProject.status === 'AWAITING_ADVANCE' && paid >= advanceRequired;
                const canClose = selectedProject.status === 'INSTALLED' && balance <= 0.001;

                return (
                  <div className="mb-4">
                    <div className="p-4 bg-slate-50 rounded flex justify-between items-center mb-3">
                      <div>
                        <span className="text-xs muted">Project Status:</span>
                        <div className="mt-1"><StatusBadge status={selectedProject.status} /></div>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="muted block">Total Quoted:</span>
                          <strong>{money(total)}</strong>
                        </div>
                        <div>
                          <span className="muted block text-emerald-700">Total Paid:</span>
                          <strong className="text-emerald-700 font-bold">{money(paid)}</strong>
                        </div>
                        <div>
                          <span className="muted block text-amber-800">Pending Balance:</span>
                          <strong className="text-amber-800 font-bold">{money(balance)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Milestone Actions Box */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded mb-4 flex justify-between items-center">
                      <div>
                        {selectedProject.status === 'AWAITING_ADVANCE' && (
                          <div className="text-sm">
                            <strong>Order Confirmation Gate (Scene 2):</strong> Collect at least 30% advance ({money(advanceRequired)}) to dispatch materials and schedule the crew.
                          </div>
                        )}
                        {selectedProject.status === 'CONFIRMED' && (
                          <div className="text-sm text-emerald-800 font-semibold">
                            Order Confirmed! Dispatch pick list created in Warehouse. Crew scheduled automatically.
                          </div>
                        )}
                        {selectedProject.status === 'INSTALLED' && balance > 0 && (
                          <div className="text-sm text-amber-900 font-semibold">
                            Installation Complete! Collect final settlement balance ({money(balance)}) to close project.
                          </div>
                        )}
                        {selectedProject.status === 'INSTALLED' && balance <= 0.001 && (
                          <div className="text-sm text-emerald-800 font-semibold">
                            All payments cleared! Project ready for official closure and 20-year warranty handover.
                          </div>
                        )}
                        {selectedProject.status === 'CLOSED' && (
                          <div className="text-sm text-emerald-800 font-semibold">
                            Project is completed, paid in full, and warranties are active.
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {selectedProject.status === 'AWAITING_ADVANCE' && (
                          <>
                            <button
                              className="button outline small-button"
                              onClick={() => openPaymentModal('ADVANCE')}
                            >
                              <CreditCard size={14} /> Record Payment
                            </button>
                            <button
                              className="button primary small-button bg-emerald-600 text-white"
                              disabled={!canConfirm || busy}
                              onClick={handleConfirmProject}
                            >
                              <CheckCircle2 size={14} /> Confirm Order
                            </button>
                          </>
                        )}

                        {selectedProject.status === 'INSTALLED' && balance > 0 && (
                          <button
                            className="button primary small-button"
                            onClick={() => openPaymentModal('FINAL')}
                          >
                            <CreditCard size={14} /> Record Final Payment
                          </button>
                        )}

                        {canClose && (
                          <button
                            className="button primary small-button bg-emerald-600 text-white"
                            disabled={busy}
                            onClick={handleCloseProject}
                          >
                            <CheckCircle2 size={14} /> Officially Close Project
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Government Subsidy Paperwork Section */}
                    <div className="subsidy-box p-4 border rounded mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <Landmark size={18} className="text-amber-600" />
                          <h4 className="font-bold text-sm">PM Surya Ghar Subsidy Paperwork</h4>
                        </div>
                        <button
                          className="button outline small-button text-xs"
                          onClick={() => setSubsidyModalOpen(true)}
                        >
                          Update Subsidy Status
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-xs bg-slate-50 p-2.5 rounded">
                        <div>
                          <span className="muted block">Application Status:</span>
                          <StatusBadge status={selectedProject.subsidy?.status || 'NOT_STARTED'} size="small" />
                        </div>
                        <div>
                          <span className="muted block">Application Ref:</span>
                          <strong>{selectedProject.subsidy?.applicationRef || 'Pending submission'}</strong>
                        </div>
                        <div>
                          <span className="muted block">Expected Subsidy:</span>
                          <strong>{money(selectedProject.subsidy?.amountExpected || Math.min(78000, Number(selectedProject.capacityKw) * 18000))}</strong>
                        </div>
                        <div>
                          <span className="muted block">Disbursed to Date:</span>
                          <strong className="text-emerald-700">{money(selectedProject.subsidy?.amountReceived || 0)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Payment History Table */}
                    <div className="payment-history-section mb-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Payment Receipts ({selectedProject.payments?.length || 0})
                      </h4>
                      {selectedProject.payments?.length === 0 ? (
                        <p className="text-xs muted p-2">No payments recorded yet.</p>
                      ) : (
                        <table className="data-table text-xs">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Payment Type</th>
                              <th>Payment Mode</th>
                              <th>Reference</th>
                              <th>Amount Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProject.payments?.map((pay) => (
                              <tr key={pay.id}>
                                <td>{new Date(pay.receivedAt).toLocaleDateString('en-IN')}</td>
                                <td><strong>{pay.type}</strong></td>
                                <td>{pay.mode}</td>
                                <td>{pay.reference || '—'}</td>
                                <td><strong className="text-emerald-700">{money(pay.amount)}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Project Timeline */}
                    <div className="project-timeline-section mt-4 pt-3 border-t">
                      <h4 className="text-sm font-bold text-slate-700 mb-2">Operational Journey</h4>
                      <div className="timeline-steps">
                        {selectedProject.timeline?.map((step, idx) => (
                          <div key={idx} className="timeline-item flex items-center gap-2 text-xs py-1">
                            <span className="timeline-bullet text-emerald-600 font-bold">✓</span>
                            <strong>{step.label}</strong>
                            <span className="muted">· {new Date(step.at).toLocaleString('en-IN')}</span>
                            {step.detail && <small className="text-slate-500">({step.detail})</small>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Modal>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Record Customer Payment"
        subtitle={`Project ${selectedProject?.code} · ${selectedProject?.customer?.name}`}
      >
        <form onSubmit={handlePaymentSubmit} className="survey-form">
          <label>
            Payment Amount (₹)
            <input
              type="number"
              min="1"
              required
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />
          </label>

          <div className="form-row">
            <label>
              Payment Type
              <select
                value={paymentForm.type}
                onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value })}
              >
                <option value="ADVANCE">Advance Payment (Min 30% to confirm)</option>
                <option value="PARTIAL">Progress / Milestone Payment</option>
                <option value="FINAL">Final Settlement Balance</option>
              </select>
            </label>

            <label>
              Payment Mode
              <select
                value={paymentForm.mode}
                onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })}
              >
                <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                <option value="BANK_TRANSFER">Bank NEFT / RTGS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Debit / Credit Card</option>
              </select>
            </label>
          </div>

          <label>
            Transaction UTR / Cheque Reference
            <input
              type="text"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
              placeholder="e.g. UPI-20261031-89712 or Bank Ref"
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Recording…' : 'Record Payment Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Subsidy Paperwork Modal */}
      <Modal
        isOpen={subsidyModalOpen}
        onClose={() => setSubsidyModalOpen(false)}
        title="Update PM Surya Ghar Subsidy Paperwork"
        subtitle={`Track government subsidy application for Project ${selectedProject?.code}`}
      >
        <form onSubmit={handleSubsidySubmit} className="survey-form">
          <label>
            Subsidy Application Status
            <select
              value={subsidyForm.status}
              onChange={(e) => setSubsidyForm({ ...subsidyForm, status: e.target.value })}
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="DOCUMENTS_PENDING">Documents Pending (Electricity Bill / Bank Proof)</option>
              <option value="APPLIED">Applied on National Portal</option>
              <option value="INSPECTION_DONE">DISCOM Inspection Done</option>
              <option value="APPROVED">Subsidy Approved by Ministry</option>
              <option value="DISBURSED">Subsidy Disbursed into Bank Account</option>
              <option value="REJECTED">Application Rejected</option>
            </select>
          </label>

          <label>
            National Portal Application Reference Number
            <input
              type="text"
              value={subsidyForm.applicationRef}
              onChange={(e) => setSubsidyForm({ ...subsidyForm, applicationRef: e.target.value })}
              placeholder="e.g. PMSGY-2026-GUJ-998812"
            />
          </label>

          <div className="form-row">
            <label>
              Expected Subsidy Amount (₹)
              <input
                type="number"
                min="0"
                value={subsidyForm.amountExpected}
                onChange={(e) => setSubsidyForm({ ...subsidyForm, amountExpected: e.target.value })}
              />
            </label>

            <label>
              Actual Amount Disbursed (₹)
              <input
                type="number"
                min="0"
                value={subsidyForm.amountReceived}
                onChange={(e) => setSubsidyForm({ ...subsidyForm, amountReceived: e.target.value })}
              />
            </label>
          </div>

          <label>
            Remarks / Inspection Notes
            <textarea
              rows="2"
              value={subsidyForm.remarks}
              onChange={(e) => setSubsidyForm({ ...subsidyForm, remarks: e.target.value })}
              placeholder="e.g. Net meter installed by DISCOM engineer on 24th Oct."
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setSubsidyModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Saving…' : 'Save Subsidy Paperwork'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

