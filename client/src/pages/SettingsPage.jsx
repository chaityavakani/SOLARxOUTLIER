import React, { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { api, errorText } from '../shared/api.js';

export default function SettingsPage({ user }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const canEdit = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    api.get('/settings').then((r) => {
      const s = r.data.data;
      setSettings(s);
      setForm({
        surveyVisitRate: s.surveyVisitRate ?? 500,
        labourRatePerHour: s.labourRatePerHour ?? 350,
        serviceVisitCharge: s.serviceVisitCharge ?? 500,
        advancePercent: s.advancePercent ?? 30,
        defaultTaxPercent: s.defaultTaxPercent ?? 13.8,
        quoteValidityDays: s.quoteValidityDays ?? 15,
        surveySlaHours: s.surveySlaHours ?? 48,
      });
    }).catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await api.put('/settings', {
        surveyVisitRate: Number(form.surveyVisitRate),
        labourRatePerHour: Number(form.labourRatePerHour),
        serviceVisitCharge: Number(form.serviceVisitCharge),
        advancePercent: Number(form.advancePercent),
        defaultTaxPercent: Number(form.defaultTaxPercent),
        quoteValidityDays: Number(form.quoteValidityDays),
        surveySlaHours: Number(form.surveySlaHours),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return <p className="muted p-6">Loading settings…</p>;

  return (
    <div className="settings-page">
      <div className="welcome-card mb-6">
        <div>
          <p className="eyebrow text-amber-400">SYSTEM CONFIGURATION</p>
          <h2>Business Settings</h2>
          <p>Configure rates, charges, and operational defaults for the entire platform.</p>
        </div>
        <Settings size={40} />
      </div>

      <form onSubmit={handleSave}>
        {error && <p className="form-message error mb-4">{error}</p>}
        {saved && <p className="form-message success mb-4">Settings saved successfully.</p>}

        {/* Survey Technician Pay */}
        <div className="panel p-5 mb-4">
          <h3 className="font-bold text-slate-800 mb-1">Survey Technician Visit Pay</h3>
          <p className="text-sm text-slate-500 mb-4">
            Amount credited to a survey technician per approved site visit. Applied automatically when a survey is approved.
          </p>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Survey Visit Fee (₹ per approved visit)
          </label>
          <input
            type="number"
            min="0"
            step="50"
            className="input w-48"
            value={form.surveyVisitRate}
            onChange={(e) => setForm({ ...form, surveyVisitRate: e.target.value })}
            disabled={!canEdit}
          />
          <p className="text-xs text-slate-400 mt-1">
            Current rate: ₹{settings.surveyVisitRate ?? 500} per visit
          </p>
        </div>

        {/* Financial Defaults */}
        <div className="panel p-5 mb-4">
          <h3 className="font-bold text-slate-800 mb-4">Financial Defaults</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Advance Required (%)</span>
              <input
                type="number" min="1" max="100" step="1"
                className="input mt-1"
                value={form.advancePercent}
                onChange={(e) => setForm({ ...form, advancePercent: e.target.value })}
                disabled={!canEdit}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Default Tax (%)</span>
              <input
                type="number" min="0" max="30" step="0.1"
                className="input mt-1"
                value={form.defaultTaxPercent}
                onChange={(e) => setForm({ ...form, defaultTaxPercent: e.target.value })}
                disabled={!canEdit}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Labour Rate (₹/hour)</span>
              <input
                type="number" min="0" step="10"
                className="input mt-1"
                value={form.labourRatePerHour}
                onChange={(e) => setForm({ ...form, labourRatePerHour: e.target.value })}
                disabled={!canEdit}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Service Visit Charge (₹)</span>
              <input
                type="number" min="0" step="50"
                className="input mt-1"
                value={form.serviceVisitCharge}
                onChange={(e) => setForm({ ...form, serviceVisitCharge: e.target.value })}
                disabled={!canEdit}
              />
            </label>
          </div>
        </div>

        {/* Operational Defaults */}
        <div className="panel p-5 mb-4">
          <h3 className="font-bold text-slate-800 mb-4">Operational Defaults</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Quote Validity (days)</span>
              <input
                type="number" min="1" max="90" step="1"
                className="input mt-1"
                value={form.quoteValidityDays}
                onChange={(e) => setForm({ ...form, quoteValidityDays: e.target.value })}
                disabled={!canEdit}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Survey SLA (hours)</span>
              <input
                type="number" min="1" max="168" step="1"
                className="input mt-1"
                value={form.surveySlaHours}
                onChange={(e) => setForm({ ...form, surveySlaHours: e.target.value })}
                disabled={!canEdit}
              />
            </label>
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <button type="submit" className="button primary" disabled={busy}>
              <Save size={15} /> {busy ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        )}

        {!canEdit && (
          <p className="text-sm text-slate-400 text-right">Only Super Admin can edit these settings.</p>
        )}
      </form>
    </div>
  );
}
