import React, { useEffect, useRef, useState } from 'react';
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
  X,
  Navigation,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import SignaturePad from '../components/SignaturePad.jsx';

export default function InstallationCrewPage({ user, onNavigate }) {
  const [activeTab, setActiveTab] = useState('JOBS');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);

  // Earnings
  const [earnings, setEarnings] = useState(null);
  const [earningsLoading, setEarningsLoading] = useState(false);

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
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadJobs(); }, []);

  useEffect(() => {
    if (activeTab === 'EARNINGS') loadEarnings();
  }, [activeTab]);

  async function loadEarnings() {
    setEarningsLoading(true);
    try {
      const res = await api.get('/installations/my-earnings');
      setEarnings(res.data.data);
    } catch (_) {}
    finally { setEarningsLoading(false); }
  }

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
    setCapturedPhotos([]);
    setCameraOpen(false);
    setCameraError('');
    setCompleteModalOpen(true);
  }

  async function openCamera() {
    setCameraError('');
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      // wait for the video element to mount
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera permission and try again.');
      setCameraOpen(false);
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  function captureFrame() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPhotos((prev) => [
      ...prev,
      { dataUrl, timestamp: new Date().toLocaleTimeString('en-IN') },
    ]);
  }

  function removePhoto(index) {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
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
        photoUrls: capturedPhotos.map((p) => p.dataUrl),
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

  function getMapsUrl(project) {
    const parts = [
      project?.siteAddress,
      project?.customer?.addressLine,
      project?.customer?.city,
      project?.customer?.state,
      project?.customer?.pincode,
    ].filter(Boolean);
    if (!parts.length) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(', '))}`;
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

      {/* Tabs */}
      <div className="status-tab-bar mb-4">
        <button className={`tab-btn ${activeTab === 'JOBS' ? 'active' : ''}`} onClick={() => setActiveTab('JOBS')}>
          Assigned Installation Jobs
        </button>
        <button className={`tab-btn ${activeTab === 'EARNINGS' ? 'active' : ''}`} onClick={() => setActiveTab('EARNINGS')}>
          My Earnings & Time Log
        </button>
      </div>

      {/* Earnings Tab */}
      {activeTab === 'EARNINGS' && (
        <div className="panel p-5">
          {earningsLoading ? (
            <p className="muted">Loading earnings…</p>
          ) : earnings ? (
            <>
              {/* Summary card */}
              <div className="earnings-summary-card mb-5">
                <div>
                  <p className="eyebrow" style={{color:'var(--sun)'}}>YOUR RATE</p>
                  <h2 style={{margin:'4px 0 0',fontFamily:'Outfit,system-ui,sans-serif'}}>
                    ₹{Number(earnings.technician?.hourlyRate || 0).toFixed(0)}<span style={{fontSize:16,fontWeight:400,color:'var(--muted)'}}> / hour</span>
                  </h2>
                  {!earnings.technician?.hourlyRate && (
                    <p className="text-xs" style={{color:'var(--red)',marginTop:4}}>Hourly rate not set — contact your Super Admin.</p>
                  )}
                </div>
                <div style={{textAlign:'right'}}>
                  <p className="text-xs muted">Total earned (all time)</p>
                  <strong style={{fontSize:26,color:'var(--green)'}}>
                    ₹{earnings.payouts.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Time logs */}
              <h3 style={{fontSize:15,fontWeight:700,marginBottom:10}}>Installation Time Log</h3>
              {earnings.timeLogs.length === 0 ? (
                <p className="muted text-sm">No time logs yet. Start an installation job to begin tracking.</p>
              ) : (
                <div className="table-wrap mb-5">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Started</th>
                        <th>Finished</th>
                        <th>Duration</th>
                        <th>Rate</th>
                        <th>Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnings.timeLogs.map((log) => {
                        const mins = log.minutes || 0;
                        const hrs = (mins / 60).toFixed(2);
                        const rate = Number(log.technician?.hourlyRate || 0);
                        const earned = ((mins / 60) * rate).toFixed(2);
                        return (
                          <tr key={log.id}>
                            <td>{new Date(log.startedAt).toLocaleDateString('en-IN')}</td>
                            <td>{new Date(log.startedAt).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}</td>
                            <td>{log.endedAt ? new Date(log.endedAt).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : <span className="badge-amber text-xs px-2 py-0.5 rounded">In Progress</span>}</td>
                            <td><strong>{mins} min</strong> <small className="muted">({hrs} hrs)</small></td>
                            <td>₹{rate}/hr</td>
                            <td><strong style={{color:'var(--green)'}}>₹{log.endedAt ? earned : '—'}</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payout records */}
              {earnings.payouts.length > 0 && (
                <>
                  <h3 style={{fontSize:15,fontWeight:700,marginBottom:10}}>Payout Records</h3>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Total Minutes</th>
                          <th>Rate</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earnings.payouts.map((p) => (
                          <tr key={p.id}>
                            <td>{new Date(p.periodStart).toLocaleDateString('en-IN')} — {new Date(p.periodEnd).toLocaleDateString('en-IN')}</td>
                            <td>{p.totalMinutes} min ({(p.totalMinutes/60).toFixed(2)} hrs)</td>
                            <td>₹{Number(p.hourlyRate)}/hr</td>
                            <td><strong>₹{Number(p.amount).toFixed(2)}</strong></td>
                            <td>
                              <span className={`badge-${p.status === 'PAID' ? 'green' : p.status === 'APPROVED' ? 'blue' : 'amber'} text-xs px-2 py-0.5 rounded`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="muted">Unable to load earnings data.</p>
          )}
        </div>
      )}

      {/* Main Jobs Queue */}
      {activeTab === 'JOBS' && <div className="panel">
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
                      <MapPin size={12} />
                      <span>
                        {[job.project?.siteAddress, job.project?.customer?.addressLine, job.project?.customer?.city, job.project?.customer?.state, job.project?.customer?.pincode]
                          .filter(Boolean).join(', ') || 'Site Address'}
                      </span>
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
                <div className="mt-4 pt-3 border-t flex flex-wrap justify-between gap-2">
                  {/* Google Maps navigation */}
                  {getMapsUrl(job.project) && (
                    <a
                      href={getMapsUrl(job.project)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button outline small-button"
                      style={{color:'#1a73e8',borderColor:'#1a73e8',gap:5,textDecoration:'none'}}
                    >
                      <Navigation size={14} /> Get Directions
                    </a>
                  )}

                  <div className="flex gap-2 ml-auto">
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
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* Field Completion & Digital Signature Modal */}
      <Modal
        isOpen={completeModalOpen}
        onClose={() => { closeCamera(); setCompleteModalOpen(false); }}
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

          {/* Live Camera Capture — getUserMedia, no file picker */}
          <div className="live-camera-section">
            <div className="live-camera-header">
              <Camera size={15} />
              <strong>Live Site Photos ({capturedPhotos.length} captured)</strong>
              <span className="live-badge">LIVE ONLY</span>
            </div>
            <p className="text-xs muted">
              Opens your camera directly — no file or gallery access, photos are always taken live on-site.
            </p>

            {cameraError && <p className="text-xs" style={{color:'var(--red)'}}>{cameraError}</p>}

            {/* Live video viewfinder */}
            {cameraOpen && (
              <div className="camera-viewfinder">
                <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                <div className="camera-controls">
                  <button type="button" className="camera-shutter" onClick={captureFrame} title="Take photo">
                    <Camera size={22} />
                  </button>
                  <button type="button" className="camera-close" onClick={closeCamera} title="Close camera">
                    <X size={16} /> Close
                  </button>
                </div>
              </div>
            )}

            {!cameraOpen && (
              <button type="button" className="button outline small-button" onClick={openCamera}>
                <Camera size={14} /> Open Live Camera
              </button>
            )}

            {capturedPhotos.length > 0 && (
              <div className="captured-photos-grid">
                {capturedPhotos.map((photo, i) => (
                  <div key={i} className="captured-photo-item">
                    <img src={photo.dataUrl} alt={`Site photo ${i + 1}`} />
                    <div className="captured-photo-meta">
                      <span>Photo {i + 1}</span>
                      <span style={{color:'var(--green)'}}>{photo.timestamp}</span>
                    </div>
                    <button type="button" className="captured-photo-remove" onClick={() => removePhoto(i)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {capturedPhotos.length === 0 && !cameraOpen && (
              <p className="text-xs muted">No photos captured yet. At least 1 photo recommended.</p>
            )}
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

