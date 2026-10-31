import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Calendar,
  Layers,
  CheckCircle2,
  Printer,
  Sun,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';

export default function SharedReportPage({ token, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/reports/shared/${token}`);
        setData(res.data.data.data);
      } catch (err) {
        setError(errorText(err));
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchReport();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <p className="text-slate-600">Loading shared financial report…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
        <AlertTriangle size={36} className="text-red-500 mb-2" />
        <h2 className="text-xl font-bold mb-1">Report Unavailable</h2>
        <p className="text-slate-600 mb-4">{error || 'This link may have expired or is invalid.'}</p>
        {onBack && (
          <button className="button outline small-button" onClick={onBack}>
            <ArrowLeft size={15} /> Back to SunPower
          </button>
        )}
      </div>
    );
  }

  const { metrics, cashFlow, subsidies, repairs, projectProfits, unfinishedProjects } = data;

  return (
    <div className="shared-report-container min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="brand-mark">
              <Sun size={18} />
            </span>
            <strong className="text-xl font-bold text-slate-900">SunPower Solutions</strong>
            <span className="badge-blue text-xs px-2 py-0.5 rounded ml-2">Executive Snapshot</span>
          </div>

          <div className="flex gap-2">
            <button className="button outline small-button" onClick={() => window.print()}>
              <Printer size={15} /> Print Report
            </button>
            {onBack && (
              <button className="button light small-button" onClick={onBack}>
                Exit
              </button>
            )}
          </div>
        </div>

        {/* Welcome Card */}
        <div className="welcome-card mb-6">
          <div>
            <p className="eyebrow text-amber-400">EXECUTIVE MONTH-END FINANCIALS</p>
            <h2>SunPower Solutions Director Review</h2>
            <p>
              Which installations made money, which lost money, and what is still unfinished.
            </p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <span className="text-xs uppercase muted font-bold">Today's Collections</span>
            <strong>{money(metrics.revenueToday)}</strong>
          </div>
          <div className="stat-card">
            <span className="text-xs uppercase muted font-bold">This Week's Revenue</span>
            <strong>{money(metrics.revenueThisWeek)}</strong>
          </div>
          <div className="stat-card">
            <span className="text-xs uppercase muted font-bold">This Month's Revenue</span>
            <strong>{money(metrics.revenueThisMonth)}</strong>
          </div>
          <div className="stat-card">
            <span className="text-xs uppercase muted font-bold">Gross Margin & Profit</span>
            <strong className="text-emerald-700">
              {metrics.overallMargin}% ({money(metrics.overallProfit)})
            </strong>
          </div>
        </div>

        {/* Profitability Per Job Table */}
        <div className="panel p-5 mb-6">
          <div className="panel-head mb-3">
            <div>
              <h3>Installation Profitability (Per Job)</h3>
              <p>Quoted revenue vs materials cost, crew labor, and net margin.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job Code</th>
                  <th>Customer</th>
                  <th>System</th>
                  <th>Revenue</th>
                  <th>Materials Cost</th>
                  <th>Labor Cost</th>
                  <th>Net Profit</th>
                  <th>Margin %</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {projectProfits.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.code}</strong></td>
                    <td>{p.customerName}</td>
                    <td>{p.capacityKw} kW · {p.systemType?.replace('_', '-')}</td>
                    <td><strong>{money(p.revenue)}</strong></td>
                    <td>{money(p.materialCost)}</td>
                    <td>{money(p.laborCost)}</td>
                    <td className={p.isProfitable ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                      {p.netProfit >= 0 ? `+${money(p.netProfit)}` : `-${money(Math.abs(p.netProfit))}`}
                    </td>
                    <td><strong>{p.marginPercent}%</strong></td>
                    <td>
                      {p.isProfitable ? (
                        <span className="badge-green text-xs px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <CheckCircle2 size={12} /> Made Money
                        </span>
                      ) : (
                        <span className="badge-red text-xs px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <AlertTriangle size={12} /> Lost Money
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cash Flow & Subsidies */}
        <div className="grid-2-col mb-6">
          <div className="panel p-5">
            <h4 className="font-bold text-sm mb-3">Cash Flow & Outstanding Balances</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="muted">Advance Payments Collected:</span>
                <strong>{money(cashFlow.advanceCollected)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="muted">Final Payments Collected:</span>
                <strong>{money(cashFlow.finalCollected)}</strong>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Total Collected:</span>
                <strong className="text-emerald-700">{money(cashFlow.totalCollected)}</strong>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-amber-800">
                <span>Outstanding Receivables:</span>
                <strong>{money(cashFlow.totalOutstanding)}</strong>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h4 className="font-bold text-sm mb-3">PM Surya Ghar Subsidy Pipeline</h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
              <div className="p-2 bg-slate-50 rounded">
                <span className="muted block">Applied</span>
                <strong>{subsidies.statusCounts.APPLIED}</strong>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="muted block">Approved</span>
                <strong>{subsidies.statusCounts.APPROVED}</strong>
              </div>
              <div className="p-2 bg-emerald-50 rounded text-emerald-900 font-bold">
                <span className="block">Disbursed</span>
                <strong>{subsidies.statusCounts.DISBURSED}</strong>
              </div>
            </div>
            <div className="space-y-1 text-xs border-t pt-2">
              <div className="flex justify-between">
                <span className="muted">Expected Subsidy:</span>
                <strong>{money(subsidies.expectedTotal)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="muted">Received / Disbursed:</span>
                <strong className="text-emerald-700">{money(subsidies.receivedTotal)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

