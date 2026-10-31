import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  Share2,
  CheckCircle2,
  Calendar,
  Layers,
  Wrench,
  FileText,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

export default function DirectorDashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'PROFIT', 'LOSS'
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports/director-summary');
      setData(res.data.data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShareLink() {
    setShareLoading(true);
    try {
      const res = await api.post('/reports/share', { expiresInDays: 7 });
      const fullUrl = `${window.location.origin}/#share=${res.data.data.token}`;
      setShareUrl(fullUrl);
      setShareModalOpen(true);
    } catch (err) {
      alert(errorText(err));
    } finally {
      setShareLoading(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading && !data) {
    return <div className="panel p-6"><p className="muted">Loading Director's Month-End Analytics…</p></div>;
  }

  if (error && !data) {
    return (
      <div className="panel p-6">
        <p className="error">{error}</p>
        <button className="button outline small-button mt-4" onClick={loadSummary}>Retry</button>
      </div>
    );
  }

  const { metrics, cashFlow, subsidies, repairs, technicians, projectProfits, unfinishedProjects } = data;

  const filteredProjects = projectProfits.filter((p) => {
    if (filter === 'PROFIT') return p.isProfitable;
    if (filter === 'LOSS') return !p.isProfitable;
    return true;
  });

  return (
    <div className="director-dashboard">
      {/* Top Banner & Header */}
      <div className="welcome-card mb-6">
        <div>
          <p className="eyebrow text-amber-400">EXECUTIVE OVERVIEW</p>
          <h2>The Director's Month-End</h2>
          <p>Financial margins, job profitability, stock costs, subsidy paperwork, and unfinished steps in one clear view.</p>
        </div>
        <div className="flex gap-2">
          <button className="button light small-button" onClick={loadSummary} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="button primary small-button" onClick={handleCreateShareLink} disabled={shareLoading}>
            <Share2 size={15} /> {shareLoading ? 'Generating…' : 'Share Numbers'}
          </button>
        </div>
      </div>

      {/* 4 Primary Financial KPI Cards */}
      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-icon text-amber-600"><Calendar size={20} /></div>
          <span>Today's Collections</span>
          <strong>{money(metrics.revenueToday)}</strong>
          <small className="text-emerald-600">Live payments received today</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon text-blue-600"><TrendingUp size={20} /></div>
          <span>This Week's Revenue</span>
          <strong>{money(metrics.revenueThisWeek)}</strong>
          <small className="text-emerald-600">Past 7 days cash flow</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon text-indigo-600"><DollarSign size={20} /></div>
          <span>This Month's Revenue</span>
          <strong>{money(metrics.revenueThisMonth)}</strong>
          <small className="text-emerald-600">Total Month-to-date income</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon text-emerald-600"><Layers size={20} /></div>
          <span>Gross Margin & Profit</span>
          <strong className={metrics.overallProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}>
            {metrics.overallMargin}% ({money(metrics.overallProfit)})
          </strong>
          <small>{metrics.profitableCount} profitable · {metrics.lossCount} loss-making</small>
        </div>
      </div>

      {/* Quick Summary Strip: Cash Flow & Subsidies */}
      <div className="grid-2-col mb-6">
        {/* Cash Flow Status */}
        <div className="panel p-5">
          <div className="panel-head mb-4">
            <div>
              <h3>Cash Flow & Outstanding Balances</h3>
              <p>Advance payments vs pending customer settlements.</p>
            </div>
          </div>
          <div className="progress-stats">
            <div className="stat-row">
              <span className="muted">Advance Payments Collected:</span>
              <strong>{money(cashFlow.advanceCollected)}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Final Payments Collected:</span>
              <strong>{money(cashFlow.finalCollected)}</strong>
            </div>
            <div className="stat-row border-top pt-2">
              <span className="font-semibold">Total Collected to Date:</span>
              <strong className="text-emerald-700 font-bold">{money(cashFlow.totalCollected)}</strong>
            </div>
            <div className="stat-row border-top pt-2">
              <span className="text-amber-800 font-semibold">Pending Outstanding Receivables:</span>
              <strong className="text-amber-800 font-bold">{money(cashFlow.totalOutstanding)}</strong>
            </div>
          </div>
        </div>

        {/* PM Surya Ghar Subsidy Tracker */}
        <div className="panel p-5">
          <div className="panel-head mb-4">
            <div>
              <h3>Government Subsidy Paperwork</h3>
              <p>PM Surya Ghar Muft Bijli Yojana pipeline.</p>
            </div>
            <span className="badge-blue px-2 py-1 rounded text-xs font-semibold">
              {subsidies.totalCases} Eligible Projects
            </span>
          </div>

          <div className="subsidy-pipeline">
            <div className="subsidy-step">
              <small>Not Started</small>
              <strong>{subsidies.statusCounts.NOT_STARTED}</strong>
            </div>
            <div className="subsidy-step">
              <small>Docs Pending</small>
              <strong>{subsidies.statusCounts.DOCUMENTS_PENDING}</strong>
            </div>
            <div className="subsidy-step">
              <small>Applied</small>
              <strong>{subsidies.statusCounts.APPLIED}</strong>
            </div>
            <div className="subsidy-step">
              <small>Inspection Done</small>
              <strong>{subsidies.statusCounts.INSPECTION_DONE}</strong>
            </div>
            <div className="subsidy-step">
              <small>Approved</small>
              <strong>{subsidies.statusCounts.APPROVED}</strong>
            </div>
            <div className="subsidy-step highlight">
              <small>Disbursed</small>
              <strong className="text-emerald-700">{subsidies.statusCounts.DISBURSED}</strong>
            </div>
          </div>

          <div className="subsidy-totals mt-4 border-top pt-2 text-sm flex justify-between">
            <span>Expected: <strong>{money(subsidies.expectedTotal)}</strong></span>
            <span>Received: <strong className="text-emerald-700">{money(subsidies.receivedTotal)}</strong></span>
            <span>Pending: <strong className="text-amber-700">{money(subsidies.pendingDisbursement)}</strong></span>
          </div>
        </div>
      </div>

      {/* Which Installations Made Money vs Lost Money */}
      <div className="panel mb-6">
        <div className="panel-head flex justify-between items-center mb-4">
          <div>
            <h2>Installation Profitability (Per Job)</h2>
            <p>Reveals which installations made money, which lost money, stock purchases and technician hours.</p>
          </div>
          <div className="filter-pill-group">
            <button
              className={`pill-btn ${filter === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              All Jobs ({projectProfits.length})
            </button>
            <button
              className={`pill-btn text-emerald-700 ${filter === 'PROFIT' ? 'active' : ''}`}
              onClick={() => setFilter('PROFIT')}
            >
              Profitable ({metrics.profitableCount})
            </button>
            <button
              className={`pill-btn text-red-700 ${filter === 'LOSS' ? 'active' : ''}`}
              onClick={() => setFilter('LOSS')}
            >
              Loss-Making ({metrics.lossCount})
            </button>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <p className="muted p-4">No installation jobs in this category.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table director-profit-table">
              <thead>
                <tr>
                  <th>Job Code</th>
                  <th>Customer</th>
                  <th>System</th>
                  <th>Revenue</th>
                  <th>Hardware</th>
                  <th>Labour</th>
                  <th>Expenses</th>
                  <th>Net Profit</th>
                  <th>Margin</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.code}</strong></td>
                    <td>
                      <div>{p.customerName}</div>
                      <small className="muted">{p.customerPhone}</small>
                    </td>
                    <td>{p.capacityKw} kW · {p.systemType.replace('_', '-')}</td>
                    <td><strong>{money(p.revenue)}</strong></td>
                    <td>{money(p.materialCost)}</td>
                    <td>{money(p.laborCost)}</td>
                    <td>{money(p.expensesCost)}</td>
                    <td className={p.isProfitable ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                      {p.netProfit >= 0 ? `+${money(p.netProfit)}` : `-${money(Math.abs(p.netProfit))}`}
                    </td>
                    <td>
                      <span className={`font-semibold ${p.isProfitable ? 'text-emerald-700' : 'text-red-700'}`}>
                        {p.marginPercent}%
                      </span>
                    </td>
                    <td>
                      {p.isProfitable ? (
                        <span className="badge-green text-xs px-2 py-1 rounded inline-flex items-center gap-1">
                          <CheckCircle2 size={13} /> Made Money
                        </span>
                      ) : (
                        <span className="badge-red text-xs px-2 py-1 rounded inline-flex items-center gap-1">
                          <AlertTriangle size={13} /> Lost Money
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unfinished Installations & Open Repairs */}
      <div className="grid-2-col mb-6">
        {/* Unfinished Installations Pipeline */}
        <div className="panel p-5">
          <div className="panel-head mb-3">
            <div>
              <h3>Unfinished Installations ({unfinishedProjects.length})</h3>
              <p>Jobs awaiting advance, warehouse packing, transit, or final testing.</p>
            </div>
          </div>
          {unfinishedProjects.length === 0 ? (
            <p className="muted p-4">All customer installations are complete and closed!</p>
          ) : (
            <div className="unfinished-list">
              {unfinishedProjects.map((item) => (
                <div key={item.id} className="unfinished-card">
                  <div className="unfinished-head">
                    <strong>{item.code} · {item.customerName}</strong>
                    <StatusBadge status={item.status} size="small" />
                  </div>
                  <div className="unfinished-body">
                    <span>{item.capacityKw} kW · {item.systemType.replace('_', '-')}</span>
                    <span className="text-amber-800">
                      Balance pending: <strong>{money(item.balance)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open Repairs & Rainy Season Warranty Tickets */}
        <div className="panel p-5">
          <div className="panel-head mb-3">
            <div>
              <h3>Open Warranty Repairs & Service Tickets</h3>
              <p>Active support tickets from customer calls.</p>
            </div>
            <span className="badge-amber px-2 py-1 rounded text-xs font-semibold">
              {repairs.openCount} Open Tickets
            </span>
          </div>

          <div className="ticket-coverage-split mb-4 p-3 bg-slate-50 rounded flex justify-between text-sm">
            <div>
              <span className="text-emerald-700 font-semibold">Under Free Warranty (₹0):</span>{' '}
              <strong>{repairs.underWarrantyCount}</strong>
            </div>
            <div>
              <span className="text-amber-800 font-semibold">Out-of-Warranty Billable:</span>{' '}
              <strong>{repairs.chargeableCount}</strong>
            </div>
          </div>

          {repairs.openTickets.length === 0 ? (
            <p className="muted p-4">No open tickets at this time. All systems running smoothly!</p>
          ) : (
            <div className="ticket-list-mini">
              {repairs.openTickets.map((t) => (
                <div key={t.id} className="ticket-mini-card">
                  <div className="flex justify-between items-start">
                    <strong>{t.number} · {t.customerName}</strong>
                    <StatusBadge status={t.status} size="small" />
                  </div>
                  <div className="text-xs text-muted flex gap-3 mt-1">
                    <span>Category: {t.category}</span>
                    {t.faultCode && <span className="font-mono text-red-600">Fault: {t.faultCode}</span>}
                    <span className={t.isUnderWarranty ? 'text-emerald-700 font-medium' : 'text-amber-700'}>
                      {t.isUnderWarranty ? 'Free Warranty Coverage' : 'Billable Rate'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Technician Hours & Payroll Summary */}
      <div className="panel p-5">
        <div className="panel-head mb-4">
          <div>
            <h3>Technician Hours & Payroll</h3>
            <p>Field crew hours logged on rooftop installations and roof surveys.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Jobs Done</th>
                <th>Surveys</th>
                <th>Hours</th>
                <th>Rate/hr</th>
                <th>Est. Payroll</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map((tech) => (
                <tr key={tech.id}>
                  <td><strong>{tech.name}</strong></td>
                  <td><small className="muted">{tech.role.replaceAll('_', ' ')}</small></td>
                  <td>{tech.phone || '—'}</td>
                  <td>{tech.installCount}</td>
                  <td>{tech.surveyCount}</td>
                  <td>{tech.estimatedHours} hrs</td>
                  <td>₹{tech.hourlyRate}/hr</td>
                  <td><strong className="text-emerald-700">{money(tech.estimatedPay)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Share Report Modal */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share Director's Month-End Numbers"
        subtitle="Anyone with this secure link can view this financial summary snapshot without logging in."
      >
        <div className="share-modal-body">
          <p className="text-sm muted mb-3">
            This tokenized link is valid for 7 days. You can share it with board members, partners, or investors.
          </p>
          <div className="share-link-input-group">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="share-link-input"
              onClick={(e) => e.target.select()}
            />
            <button className="button primary small-button" onClick={copyToClipboard}>
              <Copy size={15} /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="button outline small-button inline-flex items-center gap-1"
            >
              <ExternalLink size={14} /> Open in New Tab
            </a>
            <button className="button light small-button" onClick={() => setShareModalOpen(false)}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

