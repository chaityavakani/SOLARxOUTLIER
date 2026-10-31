import React, { useEffect, useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Camera,
  FileCheck,
  Zap,
  MapPin,
  Phone,
  ArrowRight,
  ShieldCheck,
  PenTool,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import SignaturePad from '../components/SignaturePad.jsx';

export default function InstallationCrewPage({ user, onNavigate }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);

  // Field execution form
  const [checklist, setChecklist] = useState({
    standsMounted: true,
    panelsLaid: true,
    boxesConnected: true,
    earthingFinished: true,
    generationTested: true,
  });

  const [testForm, setTestForm] = useState({
    confirmedCapacityKw: 3,
    generationTestKw: 2.8,
    signedByName: '',
    remarks: 'Installation tested and verified. Inverter generation normal.',
  });

  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [photoUrls, setPhotoUrls] = useState([
    'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600',
    'https://images.unsplash.com/photo-1508873696983-2df57046475a?w=600',
    'https://images.unsplash.com/photo-1558441719-8b449c6ff673?w=600',
  ]);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    try {
      const res = await api.get('/installations');
      setJobs(res.data.data || []);
    } catch (err) {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartJob(jobId) {
    setBusy(true);
    try {
      await api.post(`/installations/${jobId}/start`);
      loadJobs();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function openCompletionModal(job) {
    setSelectedJob(job);
    setTestForm({
      confirmedCapacityKw: Number(job.project?.capacityKw || 3),
      generationTestKw: Number(job.project?.capacityKw || 3) * 0.9,
      signedByName: job.project?.customer?.name || '',
      remarks: 'Mounted stands, laid panels, connected boxes, completed earthing and verified power generation.',
    });
    setSignatureDataUrl('');
    setCompleteModalOpen(true);
  }

  async function handleCompleteJob(e) {
    e.preventDefault();
    if (!selectedJob) return;
    if (!signatureDataUrl) {
      alert('Please have the homeowner sign on the screen to accept the work.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/installations/${selectedJob.id}/complete`, {
        confirmedCapacityKw: Number(testForm.confirmedCapacityKw),
        generationTestKw: Number(testForm.generationTestKw),
        checklist,
        photoUrls,
        signatureDataUrl,
        signedByName: testForm.signedByName,
        remarks: testForm.remarks,
      });
      setCompleteModalOpen(false);
      loadJobs();
      alert('Installation job complete! Homeowner signature recorded as proof of work.');
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="installation-page">
      {/* Top Banner */}
      <div className="welcome-card mb-4">
        <div>
          <p className="eyebrow text-amber-400">ON THE ROOF (SCENE 4)</p>
          <h2>Field Crew Installation Workspace</h2>
          <p>
            Mount stands, connect boxes, test power generation, and capture the homeowner's digital signature on tablet or phone.
          </p>
        </div>
      </div>

      {/* Main Jobs Queue */}
      <div className="panel">
        <div className="panel-head mb-3">
          <div>
            <h2>Assigned Installation Jobs</h2>
            <p>Field installations assigned to your crew.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted p-6">Loading installation jobs…</p>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <Wrench size={32} />
            <h3>No installation jobs assigned</h3>
            <p>Jobs appear here when project orders are confirmed and dispatched.</p>
          </div>
        ) : (
          <div className="job-cards-grid">
            {jobs.map((job) => (
              <div key={job.id} className="job-card-item p-5 border rounded bg-white shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                      {job.project?.code}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{job.project?.customer?.name}</h3>
                    <p className="text-xs muted flex items-center gap-1 mt-0.5">
                      <MapPin size={12} /> {job.project?.siteAddress || job.project?.customer?.addressLine || 'Site Address'}
                    </p>
                    <p className="text-xs muted flex items-center gap-1 mt-0.5">
                      <Phone size={12} /> {job.project?.customer?.phone}
                    </p>
                  </div>
                  <StatusBadge status={job.status} size="small" />
                </div>

                <div className="job-specs-chip p-2.5 bg-slate-50 rounded text-xs flex justify-between flex-wrap gap-2 font-semibold mb-3">
                  <span>System: {Number(job.project?.capacityKw)} kW · {job.project?.systemType.replace('_', '-')}</span>
                  <span>Scheduled: {job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString('en-IN') : 'As Ready'}</span>
                </div>

                {job.status === 'COMPLETED' && (
                  <div className="p-3 bg-emerald-50 rounded text-xs text-emerald-900 space-y-1 mb-3">
                    <div className="font-bold flex items-center gap-1">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Installation Verified & Signed Off!
                    </div>
                    <div>Tested Generation: <strong>{Number(job.generationTestKw)} kW</strong></div>
                    <div>Signed By Homeowner: <strong>{job.signedByName}</strong></div>
                    <div>Finished At: {new Date(job.finishedAt).toLocaleString('en-IN')}</div>
                    {job.customerSignatureUrl && (
                      <div className="mt-2 pt-2 border-t border-emerald-200">
                        <small className="muted block mb-1">Customer Digital Signature Proof:</small>
                        <img
                          src={`http://localhost:5000${job.customerSignatureUrl}`}
                          alt="Customer Signature"
                          className="h-10 bg-white p-1 border rounded"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                  {['UNSCHEDULED', 'SCHEDULED'].includes(job.status) && (
                    <button
                      className="button primary small-button"
                      disabled={busy}
                      onClick={() => handleStartJob(job.id)}
                    >
                      <Zap size={14} /> Start Installation (Clock On)
                    </button>
                  )}

                  {job.status === 'IN_PROGRESS' && (
                    <button
                      className="button primary small-button bg-emerald-600 text-white"
                      onClick={() => openCompletionModal(job)}
                    >
                      <PenTool size={14} /> Complete & Sign Off with Customer
                    </button>
                  )}

                  {job.status === 'COMPLETED' && (
                    <button
                      className="button outline small-button text-xs"
                      onClick={() => onNavigate('projects')}
                    >
                      View in Projects
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Field Completion & Digital Signature Modal */}
      <Modal
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Rooftop Installation Completion & Proof of Job"
        subtitle={`Scene 4 Form: Verify power generation and capture homeowner signature for ${selectedJob?.project?.customer?.name}.`}
        maxWidth="750px"
      >
        <form onSubmit={handleCompleteJob} className="survey-form">
          {message && <p className="form-message error">{message}</p>}

          {/* Checklist */}
          <div className="p-3 bg-slate-50 rounded mb-3">
            <strong className="text-xs uppercase text-slate-700 block mb-2 font-bold">
              Installation Quality Checklist (Scene 4)
            </strong>
            <div className="space-y-1.5 text-xs">
              <label className="check">
                <input
                  type="checkbox"
                  checked={checklist.standsMounted}
                  onChange={(e) => setChecklist({ ...checklist, standsMounted: e.target.checked })}
                />
                <span>Mount metal stands securely to roof surface</span>
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={checklist.panelsLaid}
                  onChange={(e) => setChecklist({ ...checklist, panelsLaid: e.target.checked })}
                />
                <span>Lay, position, and fasten solar panels to stands</span>
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={checklist.boxesConnected}
                  onChange={(e) => setChecklist({ ...checklist, boxesConnected: e.target.checked })}
                />
                <span>Connect AC & DC junction protection boxes</span>
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={checklist.earthingFinished}
                  onChange={(e) => setChecklist({ ...checklist, earthingFinished: e.target.checked })}
                />
                <span>Finish safety earthing and lightning surge protection</span>
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={checklist.generationTested}
                  onChange={(e) => setChecklist({ ...checklist, generationTested: e.target.checked })}
                />
                <span>Test live power generation on inverter display</span>
              </label>
            </div>
          </div>

          {/* Generation Reading */}
          <div className="form-row">
            <label>
              Confirmed System Size (kW)
              <input
                type="number"
                step="0.5"
                required
                value={testForm.confirmedCapacityKw}
                onChange={(e) => setTestForm({ ...testForm, confirmedCapacityKw: e.target.value })}
              />
            </label>

            <label>
              Tested Live Power Generation Output (kW)
              <input
                type="number"
                step="0.1"
                required
                placeholder="e.g. 2.8"
                value={testForm.generationTestKw}
                onChange={(e) => setTestForm({ ...testForm, generationTestKw: e.target.value })}
              />
            </label>
          </div>

          {/* Photo uploads preview */}
          <div className="mb-3">
            <strong className="text-xs uppercase text-slate-700 block mb-1.5 font-bold">
              Proof Photos Uploaded ({photoUrls.length} photos)
            </strong>
            <div className="flex gap-2">
              {photoUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Proof ${i + 1}`}
                  className="w-20 h-16 object-cover rounded border"
                />
              ))}
            </div>
          </div>

          <label>
            Homeowner Full Name (Signee)
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Patel"
              value={testForm.signedByName}
              onChange={(e) => setTestForm({ ...testForm, signedByName: e.target.value })}
            />
          </label>

          {/* Interactive Touch/Mouse Canvas Signature Pad */}
          <div className="mb-3">
            <strong className="text-xs uppercase text-slate-700 block mb-1 font-bold">
              Homeowner Digital Signature on Screen (Scene 4)
            </strong>
            <SignaturePad onSave={(dataUrl) => setSignatureDataUrl(dataUrl)} />
            {signatureDataUrl && (
              <div className="text-xs text-emerald-700 font-semibold mt-1">
                ✓ Homeowner signature recorded! Ready to submit.
              </div>
            )}
          </div>

          <label>
            Job Remarks
            <input
              type="text"
              value={testForm.remarks}
              onChange={(e) => setTestForm({ ...testForm, remarks: e.target.value })}
            />
          </label>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setCompleteModalOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="button primary small-button bg-emerald-600 text-white"
              disabled={busy || !signatureDataUrl}
            >
              {busy ? 'Saving Proof…' : 'Submit Job Completion & Proof'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

