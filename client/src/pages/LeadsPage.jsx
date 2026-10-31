import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  PhoneCall,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ClipboardList,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { detectGibberish } from '../shared/gibberish.js';
import { money } from '../shared/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

export default function LeadsPage({ onNavigate }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadDetailLoading, setLeadDetailLoading] = useState(false);

  // Modals state
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false);
  const [qualifyModalOpen, setQualifyModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [technicians, setTechnicians] = useState([]);

  const LEAD_LETTERS_FILTER = /[^A-Za-zऀ-ॿ\s.''-]/g;

  // Forms state
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    requestedCapacityKw: 3,
    requestedSystemType: 'ON_GRID',
    wantsSubsidy: true,
    source: 'PHONE_CALL',
  });
  const [leadFieldErrors, setLeadFieldErrors] = useState({});

  function setLeadFieldError(field, msg) {
    setLeadFieldErrors((prev) => msg ? { ...prev, [field]: msg } : (({ [field]: _, ...rest }) => rest)(prev));
  }

  const [qualifyForm, setQualifyForm] = useState({
    roofAreaSqft: 400,
    monthlyBillInr: 3000,
    gridConnectionOk: true,
    sanctionedLoadKw: 3,
    qualificationNotes: '',
    qualified: true,
  });

  const [scheduleForm, setScheduleForm] = useState({
    technicianId: '',
    scheduledAt: '',
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadLeads();
  }, [statusFilter]);

  async function loadLeads() {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search) params.q = search;
      const res = await api.get('/leads', { params });
      setLeads(res.data.data || []);
    } catch (err) {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  async function openLead(id) {
    setLeadDetailLoading(true);
    setMessage('');
    try {
      const res = await api.get(`/leads/${id}`);
      setSelectedLead(res.data.data);
      // Prepopulate qualification form
      const l = res.data.data;
      setQualifyForm({
        roofAreaSqft: Number(l.roofAreaSqft) || 400,
        monthlyBillInr: Number(l.monthlyBillInr) || 3000,
        gridConnectionOk: l.gridConnectionOk !== false,
        sanctionedLoadKw: Number(l.sanctionedLoadKw) || Number(l.requestedCapacityKw) || 3,
        qualificationNotes: l.qualificationNotes || '',
        qualified: true,
      });
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setLeadDetailLoading(false);
    }
  }

  async function handleCreateLead(e) {
    e.preventDefault();
    setMessage('');
    const LETTERS_ONLY = /^[A-Za-zऀ-ॿ\s.''-]{2,100}$/;
    const name = newLeadForm.name.trim();
    if (!name || name.length < 2) return setMessage('Full name must be at least 2 characters.');
    if (!LETTERS_ONLY.test(name)) return setMessage('Name can only contain letters — no numbers or special characters.');
    const nameGibberish = detectGibberish(name, 'Name');
    if (nameGibberish) return setMessage(nameGibberish);
    if (!newLeadForm.phone.trim()) return setMessage('Phone number is required.');
    if (!/^[0-9]{10}$/.test(newLeadForm.phone.trim())) return setMessage('Enter a valid 10-digit phone number.');
    if (newLeadForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLeadForm.email.trim())) return setMessage('Enter a valid email address.');
    const city = newLeadForm.city.trim();
    if (!city) return setMessage('City is required.');
    if (!LETTERS_ONLY.test(city)) return setMessage('City name can only contain letters — no numbers or symbols.');
    const cityGibberish = detectGibberish(city, 'City');
    if (cityGibberish) return setMessage(cityGibberish);
    setBusy(true);
    try {
      await api.post('/public/enquiries', {
        ...newLeadForm,
        capacityKw: Number(newLeadForm.requestedCapacityKw),
        systemType: newLeadForm.requestedSystemType,
      });
      setNewLeadModalOpen(false);
      setNewLeadForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        requestedCapacityKw: 3,
        requestedSystemType: 'ON_GRID',
        wantsSubsidy: true,
        source: 'PHONE_CALL',
      });
      loadLeads();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleQualifySubmit(e) {
    e.preventDefault();
    if (!selectedLead) return;
    setMessage('');
    const area = Number(qualifyForm.roofAreaSqft);
    const bill = Number(qualifyForm.monthlyBillInr);
    const load = Number(qualifyForm.sanctionedLoadKw);
    if (!area || area < 50) return setMessage('Roof area must be at least 50 sq ft.');
    if (area > 50000) return setMessage('Roof area seems too large — please verify.');
    if (!bill || bill < 100) return setMessage('Monthly bill must be at least ₹100.');
    if (bill > 500000) return setMessage('Monthly bill seems too high — please verify.');
    if (!load || load < 0.5) return setMessage('Sanctioned load must be at least 0.5 kW.');
    if (load > 1000) return setMessage('Sanctioned load seems too high — please verify.');
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/leads/${selectedLead.id}/qualify`, {
        qualified: qualifyForm.qualified,
        requestedCapacityKw: Number(selectedLead.requestedCapacityKw || 3),
        requestedSystemType: selectedLead.requestedSystemType || 'ON_GRID',
        roofAreaSqft: Number(qualifyForm.roofAreaSqft),
        monthlyBillInr: Number(qualifyForm.monthlyBillInr),
        gridConnectionOk: qualifyForm.gridConnectionOk,
        sanctionedLoadKw: Number(qualifyForm.sanctionedLoadKw),
        qualificationNotes: qualifyForm.qualificationNotes,
      });
      setQualifyModalOpen(false);
      openLead(selectedLead.id);
      loadLeads();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function openScheduleModal() {
    try {
      const res = await api.get('/users/technicians?type=survey');
      const techs = res.data.data || [];
      setTechnicians(techs);
      const tomorrow = new Date(Date.now() + 86400000);
      tomorrow.setHours(11, 0, 0, 0);
      setScheduleForm({
        technicianId: techs[0]?.id || '',
        scheduledAt: tomorrow.toISOString().slice(0, 16),
      });
      setScheduleModalOpen(true);
    } catch (err) {
      alert(errorText(err));
    }
  }

  async function handleScheduleSubmit(e) {
    e.preventDefault();
    if (!selectedLead) return;
    setMessage('');
    if (!scheduleForm.technicianId) return setMessage('Please select a survey technician.');
    if (!scheduleForm.scheduledAt) return setMessage('Please pick a date and time.');
    if (new Date(scheduleForm.scheduledAt) <= new Date()) return setMessage('Scheduled date must be in the future.');
    setBusy(true);
    setMessage('');
    try {
      await api.post('/surveys', {
        leadId: selectedLead.id,
        technicianId: scheduleForm.technicianId,
        scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
      });
      setScheduleModalOpen(false);
      openLead(selectedLead.id);
      loadLeads();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="leads-page">
      {/* Search and Filter Bar */}
      <div className="page-toolbar mb-4 flex justify-between items-center gap-3">
        <div className="search-box-wrap flex-1">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search enquiries by customer name, phone, or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
            className="search-input"
          />
        </div>

        <div className="flex gap-2">
          <button className="button primary small-button" onClick={() => setNewLeadModalOpen(true)}>
            <Plus size={16} /> New Enquiry
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="status-tab-bar mb-4">
        {[
          ['ALL', 'All Enquiries'],
          ['NEW', 'New Inquiries'],
          ['QUALIFIED', 'Feasibility Qualified'],
          ['SURVEY_SCHEDULED', 'Survey Scheduled'],
          ['SURVEY_APPROVED', 'Survey Approved'],
          ['QUOTED', 'Quote Prepared'],
          ['WON', 'Won Orders'],
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

      {/* Main Table */}
      <div className="panel">
        <div className="panel-head mb-3">
          <div>
            <h2>Rooftop Solar Enquiries</h2>
            <p>Every lead is retained, pre-screened for feasibility, and tracked to quotation.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted p-6">Loading enquiries…</p>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <h3>No enquiries found</h3>
            <p>No customer enquiries match this filter.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Enquiry Ref</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>Requested System</th>
                  <th>Subsidy</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="clickable-row" onClick={() => openLead(lead.id)}>
                    <td><strong>{lead.code}</strong></td>
                    <td>
                      <div className="font-semibold">{lead.name}</div>
                      <small className="muted">{lead.email || 'No email'}</small>
                    </td>
                    <td>{lead.phone}</td>
                    <td>{lead.city || '—'}</td>
                    <td>
                      {lead.requestedCapacityKw ? `${lead.requestedCapacityKw} kW` : 'Custom'} ·{' '}
                      {lead.requestedSystemType?.replace('_', '-')}
                    </td>
                    <td>
                      {lead.wantsSubsidy ? (
                        <span className="badge-green text-xs px-2 py-0.5 rounded">PM Surya Ghar</span>
                      ) : (
                        <span className="muted text-xs">Standard</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={lead.status} size="small" />
                    </td>
                    <td>
                      <button className="button outline small-button">Open Workflow</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lead Detail & Workflow Drawer / Modal */}
      {selectedLead && (
        <Modal
          isOpen={Boolean(selectedLead)}
          onClose={() => setSelectedLead(null)}
          title={`Enquiry Workflow: ${selectedLead.code}`}
          subtitle={`${selectedLead.name} · ${selectedLead.phone} · ${selectedLead.city || 'Site details'}`}
          maxWidth="700px"
        >
          {leadDetailLoading ? (
            <p className="muted p-4">Loading enquiry details…</p>
          ) : (
            <div className="workflow-container">
              {message && <p className="form-message error mb-3">{message}</p>}

              {/* Step 1: Pre-Screening Feasibility Call */}
              <div className="workflow-step-card">
                <div className="step-card-header">
                  <div className="flex items-center gap-2">
                    <span className="step-num">1</span>
                    <div>
                      <strong>Scene 1: Qualification Call</strong>
                      <p className="text-xs muted">Check shadow-free roof area, electricity bill, and grid phase.</p>
                    </div>
                  </div>
                  <StatusBadge status={['QUALIFIED', 'SURVEY_SCHEDULED', 'SURVEY_DONE', 'SURVEY_APPROVED', 'QUOTED', 'WON'].includes(selectedLead.status) ? 'QUALIFIED' : selectedLead.status} size="small" />
                </div>

                <div className="step-card-body">
                  <div className="meta-grid text-sm">
                    <div>Shadow-Free Roof Area: <strong>{selectedLead.roofAreaSqft ? `${selectedLead.roofAreaSqft} sq ft` : 'Not recorded yet'}</strong></div>
                    <div>Monthly Electricity Bill: <strong>{selectedLead.monthlyBillInr ? money(selectedLead.monthlyBillInr) : 'Not recorded yet'}</strong></div>
                    <div>Grid Suitability: <strong>{selectedLead.gridConnectionOk === true ? 'Suitable' : selectedLead.gridConnectionOk === false ? 'Unsuitable' : 'Pending call'}</strong></div>
                  </div>

                  {(selectedLead.status === 'NEW' || selectedLead.status === 'CONTACTED') && (
                    <button className="button primary small-button mt-3" onClick={() => setQualifyModalOpen(true)}>
                      <PhoneCall size={14} /> Record Qualification Call
                    </button>
                  )}
                </div>
              </div>

              {/* Step 2: Site Survey Scheduling */}
              <div className="workflow-step-card mt-3">
                <div className="step-card-header">
                  <div className="flex items-center gap-2">
                    <span className="step-num">2</span>
                    <div>
                      <strong>Scene 1: On-Site Roof Survey</strong>
                      <p className="text-xs muted">Technician measures roof direction, tilt degrees, and cable distance.</p>
                    </div>
                  </div>
                  {selectedLead.surveys?.length > 0 && (
                    <StatusBadge status={selectedLead.surveys[0].status} size="small" />
                  )}
                </div>

                <div className="step-card-body">
                  {selectedLead.surveys?.length > 0 ? (
                    <div className="survey-summary text-sm">
                      <p>Technician: <strong>{selectedLead.surveys[0].technician?.name || 'Assigned Technician'}</strong></p>
                      <p>Scheduled: <strong>{new Date(selectedLead.surveys[0].scheduledAt).toLocaleString('en-IN')}</strong></p>
                      {selectedLead.surveys[0].status === 'APPROVED' && (
                        <div className="text-emerald-700 font-semibold flex items-center gap-1 mt-2">
                          <CheckCircle2 size={16} /> Roof Survey Approved! Customer is eligible to receive quotation.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs muted mb-2">Once qualified, dispatch a technician to survey the rooftop.</p>
                      {selectedLead.status === 'QUALIFIED' && (
                        <button className="button primary small-button" onClick={openScheduleModal}>
                          <Calendar size={14} /> Schedule Roof Survey
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Quotation & Order */}
              <div className="workflow-step-card mt-3">
                <div className="step-card-header">
                  <div className="flex items-center gap-2">
                    <span className="step-num">3</span>
                    <div>
                      <strong>Scene 2: Quotation & BOM</strong>
                      <p className="text-xs muted">Quote generated from ready kit templates once survey is approved.</p>
                    </div>
                  </div>
                  {selectedLead.quotes?.length > 0 && (
                    <StatusBadge status={selectedLead.quotes[0].status} size="small" />
                  )}
                </div>

                <div className="step-card-body">
                  {selectedLead.quotes?.length > 0 ? (
                    <div className="quote-summary text-sm">
                      <p>Quote Number: <strong>{selectedLead.quotes[0].number}</strong></p>
                      <p>Total: <strong>{money(selectedLead.quotes[0].total)}</strong></p>
                      <button
                        className="button outline small-button mt-2"
                        onClick={() => { setSelectedLead(null); onNavigate('quotes'); }}
                      >
                        View in Quotes Workspace
                      </button>
                    </div>
                  ) : (
                    <div>
                      {selectedLead.status === 'SURVEY_APPROVED' ? (
                        <button
                          className="button primary small-button"
                          onClick={() => { setSelectedLead(null); onNavigate('quotes'); }}
                        >
                          <Zap size={14} /> Open Quotes Workspace to Generate BOM
                        </button>
                      ) : (
                        <small className="muted">
                          (BR-03 Enforced: Quotes can only be created after the roof survey is approved.)
                        </small>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* New Enquiry Modal */}
      <Modal
        isOpen={newLeadModalOpen}
        onClose={() => { setNewLeadModalOpen(false); setLeadFieldErrors({}); }}
        title="Capture New Solar Enquiry"
        subtitle="Record web inquiries, phone calls, or WhatsApp leads directly into the system."
      >
        <form onSubmit={handleCreateLead} className="survey-form">
          <label>
            Homeowner / Business Name
            <input
              type="text"
              required
              value={newLeadForm.name}
              onChange={(e) => {
                const raw = e.target.value;
                const hasInvalid = LEAD_LETTERS_FILTER.test(raw);
                const v = raw.replace(LEAD_LETTERS_FILTER, '');
                setNewLeadForm({ ...newLeadForm, name: v });
                if (hasInvalid) setLeadFieldError('name', 'Name can only contain letters — no numbers or special characters.');
                else setLeadFieldError('name', detectGibberish(v, 'Name'));
              }}
              placeholder="e.g. Ramesh Patel"
            />
            {leadFieldErrors.name && <span className="field-error">{leadFieldErrors.name}</span>}
          </label>

          <div className="form-row">
            <label>
              Phone Number
              <input
                type="tel"
                required
                value={newLeadForm.phone}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setNewLeadForm({ ...newLeadForm, phone: v });
                  if (e.target.value !== v && e.target.value.length > 0) setLeadFieldError('phone', 'Phone number must contain digits only.');
                  else if (v.length > 0 && v.length < 10) setLeadFieldError('phone', `Enter a 10-digit number (${v.length}/10 so far).`);
                  else setLeadFieldError('phone', null);
                }}
                placeholder="10-digit mobile number"
              />
              {leadFieldErrors.phone && <span className="field-error">{leadFieldErrors.phone}</span>}
            </label>
            <label>
              Email Address
              <input
                type="email"
                value={newLeadForm.email}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewLeadForm({ ...newLeadForm, email: v });
                  if (v.length > 5 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) setLeadFieldError('email', 'Enter a valid email address.');
                  else setLeadFieldError('email', null);
                }}
                placeholder="optional"
              />
              {leadFieldErrors.email && <span className="field-error">{leadFieldErrors.email}</span>}
            </label>
          </div>

          <div className="form-row">
            <label>
              City
              <input
                type="text"
                required
                value={newLeadForm.city}
                onChange={(e) => {
                  const raw = e.target.value;
                  const hasInvalid = LEAD_LETTERS_FILTER.test(raw);
                  const v = raw.replace(LEAD_LETTERS_FILTER, '');
                  setNewLeadForm({ ...newLeadForm, city: v });
                  if (hasInvalid) setLeadFieldError('city', 'City name can only contain letters — no numbers or symbols.');
                  else setLeadFieldError('city', detectGibberish(v, 'City'));
                }}
                placeholder="e.g. Anand / Ahmedabad"
              />
              {leadFieldErrors.city && <span className="field-error">{leadFieldErrors.city}</span>}
            </label>
            <label>
              Site Address
              <input
                type="text"
                value={newLeadForm.address}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, address: e.target.value })}
                placeholder="Street / Society address"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              System Capacity (kW)
              <select
                value={newLeadForm.requestedCapacityKw}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, requestedCapacityKw: Number(e.target.value) })}
              >
                <option value={1}>1 kW System</option>
                <option value={2}>2 kW System</option>
                <option value={3}>3 kW System (Recommended)</option>
                <option value={4}>4 kW System</option>
                <option value={5}>5 kW System</option>
              </select>
            </label>

            <label>
              Grid Connection Type
              <select
                value={newLeadForm.requestedSystemType}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, requestedSystemType: e.target.value })}
              >
                <option value="ON_GRID">On-Grid (Connected to Electricity Grid)</option>
                <option value="OFF_GRID">Off-Grid (With Battery Backup)</option>
              </select>
            </label>
          </div>

          <label className="check mt-2">
            <input
              type="checkbox"
              checked={newLeadForm.wantsSubsidy}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, wantsSubsidy: e.target.checked })}
            />
            <span>Apply for PM Surya Ghar Muft Bijli Yojana government subsidy</span>
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setNewLeadModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Saving…' : 'Save Enquiry'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pre-Screening Qualification Call Modal */}
      <Modal
        isOpen={qualifyModalOpen}
        onClose={() => setQualifyModalOpen(false)}
        title="Qualification Call Pre-Screening"
        subtitle="Call the customer and check shadow-free roof area, electricity bill, and grid connectivity."
      >
        <form onSubmit={handleQualifySubmit} className="survey-form">
          <div className="form-row">
            <label>
              Shadow-free Roof Area (sq ft)
              <input
                type="number"
                min="100"
                required
                value={qualifyForm.roofAreaSqft}
                onChange={(e) => setQualifyForm({ ...qualifyForm, roofAreaSqft: e.target.value })}
              />
            </label>

            <label>
              Average Monthly Electricity Bill (₹)
              <input
                type="number"
                min="500"
                required
                value={qualifyForm.monthlyBillInr}
                onChange={(e) => setQualifyForm({ ...qualifyForm, monthlyBillInr: e.target.value })}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Sanctioned Load (kW)
              <input
                type="number"
                min="1"
                required
                value={qualifyForm.sanctionedLoadKw}
                onChange={(e) => setQualifyForm({ ...qualifyForm, sanctionedLoadKw: e.target.value })}
              />
            </label>

            <label>
              Grid Connection Suitable?
              <select
                value={qualifyForm.gridConnectionOk ? 'true' : 'false'}
                onChange={(e) => setQualifyForm({ ...qualifyForm, gridConnectionOk: e.target.value === 'true' })}
              >
                <option value="true">Yes — Suitable Grid Connection</option>
                <option value="false">No — Inadequate Wiring / Transformer Issues</option>
              </select>
            </label>
          </div>

          <label>
            Pre-screening Notes
            <textarea
              rows="2"
              value={qualifyForm.qualificationNotes}
              onChange={(e) => setQualifyForm({ ...qualifyForm, qualificationNotes: e.target.value })}
              placeholder="e.g. 3-phase connection verified, owner available for site visit on weekdays."
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setQualifyModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Saving…' : 'Approve Qualification'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Roof Survey Modal */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule Roof Survey Visit"
        subtitle="Assign a technician to visit the site and take precise tilt, angle, and cable measurements."
      >
        <form onSubmit={handleScheduleSubmit} className="survey-form">
          <label>
            Assigned Survey Technician
            <select
              required
              value={scheduleForm.technicianId}
              onChange={(e) => setScheduleForm({ ...scheduleForm, technicianId: e.target.value })}
            >
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name} · {tech.phone || 'Survey Technician'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Scheduled Visit Date & Time
            <input
              type="datetime-local"
              required
              value={scheduleForm.scheduledAt}
              onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setScheduleModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Scheduling…' : 'Confirm Survey Appointment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
