import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Compass,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  MapPin,
  Calendar,
  Send,
  Zap,
  IndianRupee,
  Wallet,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import { VoiceSurveyFill, parseSurveyTranscript } from '../components/VoiceInput.jsx';

export default function SurveysPage({ user, onNavigate }) {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Earnings for technician
  const [earnings, setEarnings] = useState(null);

  // Unpaid fee queue for SuperAdmin/Director
  const [unpaidFees, setUnpaidFees] = useState([]);
  const isPayAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);

  const isTechnician = user?.role === 'SURVEY_TECHNICIAN';
  const canApprove = ['DIRECTOR', 'SALES_EXECUTIVE', 'SUPER_ADMIN'].includes(user?.role);


  // Survey Report Form
  const [reportForm, setReportForm] = useState({
    roofType: 'RCC',
    shadowFreeAreaSqft: 500,
    roofDirection: 'S',
    tiltDegrees: 18,
    cableDistanceMeters: 12,
    structureHeightFt: 6,
    earthingPointAvailable: 'true',
    recommendedCapacityKw: 3,
    recommendedSystemType: 'ON_GRID',
    notes: '',
  });

  const [voiceFilled, setVoiceFilled] = useState(false);

  function handleVoiceFill(fields) {
    setReportForm((prev) => ({ ...prev, ...fields }));
    setVoiceFilled(true);
    setTimeout(() => setVoiceFilled(false), 2500);
  }

  useEffect(() => {
    loadSurveys();
  }, [activeTab]);

  useEffect(() => {
    if (isTechnician && user?.id) {
      api.get(`/surveys/earnings/${user.id}`)
        .then((r) => setEarnings(r.data.data))
        .catch(() => {});
    }
    if (isPayAdmin) {
      api.get('/surveys/unpaid-fees')
        .then((r) => setUnpaidFees(r.data.data || []))
        .catch(() => {});
    }
  }, [surveys]);

  async function loadSurveys() {
    setLoading(true);
    try {
      const params = {};
      if (activeTab !== 'ALL') params.status = activeTab;
      const res = await api.get('/surveys', { params });
      setSurveys(res.data.data || []);
    } catch (err) {
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  }

  function openReportModal(survey) {
    setSelectedSurvey(survey);
    setReportForm({
      roofType: survey.roofType || 'RCC',
      shadowFreeAreaSqft: Number(survey.shadowFreeAreaSqft) || Number(survey.lead?.roofAreaSqft) || 500,
      roofDirection: survey.roofDirection || 'S',
      tiltDegrees: survey.tiltDegrees || 18,
      cableDistanceMeters: survey.cableDistanceMeters || 12,
      structureHeightFt: survey.structureHeightFt || 6,
      earthingPointAvailable: survey.earthingPointAvailable === false ? 'false' : 'true',
      recommendedCapacityKw: Number(survey.recommendedCapacityKw) || Number(survey.lead?.requestedCapacityKw) || 3,
      recommendedSystemType: survey.recommendedSystemType || survey.lead?.requestedSystemType || 'ON_GRID',
      notes: survey.notes || '',
    });
    setReportModalOpen(true);
  }

  async function handleStartSurvey(surveyId) {
    setBusy(true);
    try {
      await api.post(`/surveys/${surveyId}/start`);
      loadSurveys();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReportSubmit(e) {
    e.preventDefault();
    if (!selectedSurvey) return;
    setMessage('');
    const area = Number(reportForm.shadowFreeAreaSqft);
    const tilt = Number(reportForm.tiltDegrees);
    const cable = Number(reportForm.cableDistanceMeters);
    const height = Number(reportForm.structureHeightFt);
    if (!area || area < 50) return setMessage('Shadow-free area must be at least 50 sq ft.');
    if (area > 50000) return setMessage('Shadow-free area seems too large — please verify.');
    if (tilt < 0 || tilt > 90) return setMessage('Roof tilt must be between 0° and 90°.');
    if (!cable || cable < 1) return setMessage('Cable distance must be at least 1 metre.');
    if (cable > 500) return setMessage('Cable distance seems too long — please verify.');
    if (!height || height < 1) return setMessage('Structure height must be at least 1 ft.');
    if (height > 200) return setMessage('Structure height seems too high — please verify.');
    setBusy(true);
    setMessage('');
    try {
      const formData = new FormData();
      Object.entries(reportForm).forEach(([k, v]) => formData.append(k, v));
      await api.put(`/surveys/${selectedSurvey.id}/report`, formData);
      setReportModalOpen(false);
      loadSurveys();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(surveyId) {
    setBusy(true);
    try {
      await api.post(`/surveys/${surveyId}/approve`);
      loadSurveys();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid(surveyId) {
    setBusy(true);
    try {
      await api.post(`/surveys/${surveyId}/mark-paid`);
      loadSurveys();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePayAllForTechnician(surveyIds) {
    setBusy(true);
    try {
      await Promise.all(surveyIds.map((id) => api.post(`/surveys/${id}/mark-paid`)));
      loadSurveys();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    if (!selectedSurvey) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 10) {
      alert('Please provide a rejection reason (at least 10 characters).');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/surveys/${selectedSurvey.id}/reject`, { reason: rejectReason.trim() });
      setRejectModalOpen(false);
      setRejectReason('');
      loadSurveys();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surveys-page">
      {/* Page Header */}
      <div className="welcome-card mb-4">
        <div>
          <p className="eyebrow text-amber-400">FEASIBILITY GATE (SCENE 1)</p>
          <h2>{isTechnician ? 'My Roof Survey Assignments' : 'Roof Survey & Feasibility Queue'}</h2>
          <p>
            BR-03 Enforced: Quotes can only be generated after the survey direction, tilt, and cable distance are approved.
          </p>
        </div>
      </div>

      {/* Technician Earnings Summary */}
      {isTechnician && earnings && (
        <div className="panel p-4 mb-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={20} className="text-emerald-600" />
            <span className="font-bold text-slate-800">My Visit Earnings</span>
          </div>
          <div className="flex gap-6 text-center text-sm">
            <div>
              <div className="text-slate-500 text-xs">Total Earned</div>
              <div className="font-bold text-slate-900">{money(earnings.totalEarned)}</div>
            </div>
            <div>
              <div className="text-emerald-600 text-xs">Paid Out</div>
              <div className="font-bold text-emerald-700">{money(earnings.totalPaid)}</div>
            </div>
            <div>
              <div className="text-amber-600 text-xs">Pending</div>
              <div className="font-bold text-amber-700">{money(earnings.totalPending)}</div>
            </div>
          </div>
        </div>
      )}

      {/* SuperAdmin / Director: Pending Visit Fee Payouts */}
      {isPayAdmin && unpaidFees.length > 0 && (
        <div className="panel p-5 mb-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <IndianRupee size={18} className="text-amber-600" />
                Pending Visit Fee Payouts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pay survey technicians for their approved site visits.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
              {unpaidFees.reduce((s, g) => s + g.surveys.length, 0)} visit{unpaidFees.reduce((s, g) => s + g.surveys.length, 0) !== 1 ? 's' : ''} unpaid
            </span>
          </div>

          <div className="space-y-4">
            {unpaidFees.map((group) => (
              <div key={group.technician.id} className="border rounded p-4 bg-amber-50">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-bold text-slate-900">{group.technician.name}</p>
                    <p className="text-xs text-slate-500">{group.technician.phone} · {group.surveys.length} pending visit{group.surveys.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-amber-700">{money(group.total)}</span>
                    <button
                      className="button primary small-button"
                      style={{ background: '#059669' }}
                      disabled={busy}
                      onClick={() => handlePayAllForTechnician(group.surveys.map((s) => s.id))}
                    >
                      <IndianRupee size={13} /> Pay ₹{group.total.toLocaleString('en-IN')}
                    </button>
                  </div>
                </div>

                {/* Individual visits */}
                <div className="space-y-1">
                  {group.surveys.map((sv) => (
                    <div key={sv.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border">
                      <div>
                        <span className="font-semibold">{sv.lead?.name}</span>
                        <span className="text-slate-400 ml-2">{sv.lead?.city}</span>
                        <span className="text-slate-400 ml-2">
                          · Approved {sv.reviewedAt ? new Date(sv.reviewedAt).toLocaleDateString('en-IN') : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-700">{money(sv.visitFee)}</span>
                        <button
                          className="text-xs px-2 py-0.5 rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                          disabled={busy}
                          onClick={() => handleMarkPaid(sv.id)}
                        >
                          Mark Paid
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPayAdmin && unpaidFees.length === 0 && (
        <div className="panel p-4 mb-4 flex items-center gap-3 text-emerald-700 bg-emerald-50">
          <IndianRupee size={18} />
          <span className="text-sm font-semibold">All survey visit fees are paid up — no pending payouts.</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="status-tab-bar mb-4">
        {[
          ['ALL', 'All Surveys'],
          ['SCHEDULED', 'Scheduled Visits'],
          ['IN_PROGRESS', 'Survey Underway'],
          ['SUBMITTED', 'Awaiting Approval'],
          ['APPROVED', 'Approved Feasibility'],
          ['REJECTED', 'Needs Revision'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab-btn ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Surveys Content */}
      <div className="panel">
        <div className="panel-head mb-3">
          <div>
            <h2>Site Survey Reports</h2>
            <p>Rooftop azimuth, angle, shadow clearance, and inverter distance measurements.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted p-6">Loading site surveys…</p>
        ) : surveys.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={32} />
            <h3>No surveys in this queue</h3>
            <p>Schedule a survey from the Enquiries page.</p>
          </div>
        ) : (
          <div className="survey-cards-grid">
            {surveys.map((item) => (
              <div key={item.id} className="survey-card-item">
                <div className="survey-card-top flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                      {item.lead?.code}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{item.lead?.name}</h3>
                    <p className="text-xs muted flex items-center gap-1 mt-0.5">
                      <MapPin size={12} /> {item.lead?.city || item.lead?.address || 'Site Address'}
                    </p>
                  </div>
                  <StatusBadge status={item.status} size="small" />
                </div>

                <div className="survey-meta-details mt-3 pt-3 border-t text-sm">
                  <div className="flex justify-between py-1">
                    <span className="muted">Visit Scheduled:</span>
                    <strong>{new Date(item.scheduledAt).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="muted">Technician:</span>
                    <strong>{item.technician?.name || 'Unassigned'}</strong>
                  </div>

                  {item.status !== 'SCHEDULED' && item.roofDirection && (
                    <div className="survey-metrics-chip-row mt-2 p-2 bg-slate-50 rounded flex justify-between text-xs font-semibold">
                      <span>Direction: <strong>{item.roofDirection}</strong></span>
                      <span>Tilt: <strong>{item.tiltDegrees}°</strong></span>
                      <span>Cable: <strong>{item.cableDistanceMeters}m</strong></span>
                      <span>Type: <strong>{item.roofType}</strong></span>
                    </div>
                  )}

                  {item.recommendedCapacityKw && (
                    <div className="mt-2 text-xs font-semibold text-emerald-800 bg-emerald-50 p-2 rounded flex justify-between">
                      <span>Feasible Capacity: <strong>{item.recommendedCapacityKw} kW</strong></span>
                      <span>System: <strong>{item.recommendedSystemType?.replace('_', '-')}</strong></span>
                    </div>
                  )}

                  {/* Visit Fee Badge (shown on approved surveys) */}
                  {item.status === 'APPROVED' && item.visitFee != null && (
                    <div className={`mt-2 text-xs font-semibold p-2 rounded flex justify-between items-center ${item.visitFeePaid ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                      <span className="flex items-center gap-1">
                        <IndianRupee size={12} />
                        Visit Fee: <strong>{money(item.visitFee)}</strong>
                      </span>
                      <span>{item.visitFeePaid ? '✓ Paid' : '⏳ Pending Payment'}</span>
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="survey-card-actions mt-4 pt-3 border-t flex justify-end gap-2 items-center">
                  {/* Technician actions */}
                  {isTechnician && item.status === 'SCHEDULED' && (
                    <button
                      className="button primary small-button"
                      disabled={busy}
                      onClick={() => handleStartSurvey(item.id)}
                    >
                      Start Site Survey
                    </button>
                  )}

                  {isTechnician && ['SCHEDULED', 'IN_PROGRESS'].includes(item.status) && (
                    <button
                      className="button outline small-button"
                      onClick={() => openReportModal(item)}
                    >
                      Fill Survey Report
                    </button>
                  )}

                  {/* Manager / Director Feasibility Gate Approval actions */}
                  {canApprove && item.status === 'SUBMITTED' && (
                    <>
                      <button
                        className="button outline small-button text-red-700"
                        onClick={() => { setSelectedSurvey(item); setRejectModalOpen(true); }}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        className="button primary small-button text-emerald-900 bg-emerald-500"
                        disabled={busy}
                        onClick={() => handleApprove(item.id)}
                      >
                        <CheckCircle2 size={14} /> Approve Feasibility
                      </button>
                    </>
                  )}

                  {/* If Approved, direct shortcut to Quotes */}
                  {item.status === 'APPROVED' && (
                    <button
                      className="button outline small-button"
                      onClick={() => onNavigate('quotes')}
                    >
                      <Zap size={14} /> Prepare Quote BOM
                    </button>
                  )}

                  {/* SuperAdmin / Director: Mark visit fee as paid */}
                  {['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) &&
                    item.status === 'APPROVED' &&
                    item.visitFee != null &&
                    !item.visitFeePaid && (
                      <button
                        className="button primary small-button"
                        style={{ background: '#059669' }}
                        disabled={busy}
                        onClick={() => handleMarkPaid(item.id)}
                      >
                        <IndianRupee size={13} /> Mark Visit Fee Paid
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Technician Report Modal */}
      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Rooftop Feasibility Survey Report"
        subtitle={`Measurements for ${selectedSurvey?.lead?.name} (${selectedSurvey?.lead?.code})`}
      >
        <form onSubmit={handleReportSubmit} className={`survey-form${voiceFilled ? ' voice-filled' : ''}`}>
          {message && <p className="form-message error">{message}</p>}

          {/* ── AI Voice Fill ── */}
          <VoiceSurveyFill onFill={handleVoiceFill} />

          <div className="form-row">
            <label>
              Roof Material / Type
              <select
                value={reportForm.roofType}
                onChange={(e) => setReportForm({ ...reportForm, roofType: e.target.value })}
              >
                <option value="RCC">RCC Concrete Flat Roof</option>
                <option value="METAL_SHEET">Industrial Metal Sheet</option>
                <option value="TILED">Slanted Tiled Roof</option>
                <option value="OTHER">Other Surface</option>
              </select>
            </label>

            <label>
              Shadow-Free Usable Area (sq ft)
              <input
                type="number"
                min="50"
                required
                value={reportForm.shadowFreeAreaSqft}
                onChange={(e) => setReportForm({ ...reportForm, shadowFreeAreaSqft: e.target.value })}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Roof Direction (Azimuth)
              <select
                value={reportForm.roofDirection}
                onChange={(e) => setReportForm({ ...reportForm, roofDirection: e.target.value })}
              >
                <option value="S">South (Optimal Sun Exposure)</option>
                <option value="SW">South-West</option>
                <option value="SE">South-East</option>
                <option value="W">West</option>
                <option value="E">East</option>
                <option value="N">North (Sub-optimal)</option>
              </select>
            </label>

            <label>
              Optimal Tilt Angle (degrees)
              <input
                type="number"
                min="0"
                max="90"
                required
                value={reportForm.tiltDegrees}
                onChange={(e) => setReportForm({ ...reportForm, tiltDegrees: e.target.value })}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Cable Distance to Net Meter (meters)
              <input
                type="number"
                min="1"
                required
                value={reportForm.cableDistanceMeters}
                onChange={(e) => setReportForm({ ...reportForm, cableDistanceMeters: e.target.value })}
              />
            </label>

            <label>
              Mounting Structure Height (ft)
              <input
                type="number"
                min="1"
                required
                value={reportForm.structureHeightFt}
                onChange={(e) => setReportForm({ ...reportForm, structureHeightFt: e.target.value })}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Recommended Capacity (kW)
              <select
                value={reportForm.recommendedCapacityKw}
                onChange={(e) => setReportForm({ ...reportForm, recommendedCapacityKw: Number(e.target.value) })}
              >
                <option value={1}>1 kW System</option>
                <option value={2}>2 kW System</option>
                <option value={3}>3 kW System</option>
                <option value={4}>4 kW System</option>
                <option value={5}>5 kW System</option>
              </select>
            </label>

            <label>
              Recommended System Type
              <select
                value={reportForm.recommendedSystemType}
                onChange={(e) => setReportForm({ ...reportForm, recommendedSystemType: e.target.value })}
              >
                <option value="ON_GRID">On-Grid (Direct Grid Connected)</option>
                <option value="OFF_GRID">Off-Grid (With Battery Backup)</option>
              </select>
            </label>
          </div>

          <label>
            Survey Observations & Findings
            <textarea
              rows="3"
              value={reportForm.notes}
              onChange={(e) => setReportForm({ ...reportForm, notes: e.target.value })}
              placeholder="Auto-filled by voice, or type your observations here."
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setReportModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit Survey for Review'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Survey Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Survey / Request Re-measurement"
        subtitle="Explain why this survey cannot be approved."
      >
        <form onSubmit={handleRejectSubmit} className="survey-form">
          <label>
            Rejection Reason / Required Changes
            <textarea
              required
              rows="3"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Shadow analysis incomplete on West perimeter wall. Re-measure distance."
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button text-red-700" disabled={busy}>
              {busy ? 'Rejecting…' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

