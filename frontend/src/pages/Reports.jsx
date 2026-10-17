import { businessDay, businessMonthStart } from '../utils/businessDate';
// ─────────────────────────────────────────────────────────────
// src/pages/Reports.jsx — Profit & Loss Report with chart
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, exportAPI, downloadBlob } from '../api/services';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';
import { FileDown, Calendar, TrendingUp, TrendingDown, DollarSign, Percent, BarChart3 } from 'lucide-react';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) : '—'; }

// Default to current month
const today = new Date();
const defaultFrom = businessMonthStart();
const defaultTo = businessDay(today);

export default function Reports() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const { data, isLoading } = useQuery({
    queryKey: ['profit-report', from, to],
    queryFn: () => reportsAPI.profit({ from, to }).then((r) => r.data),
  });

  async function exportDoc(fmt) {
    try {
      const params = { from, to };
      const res = fmt === 'pdf' ? await exportAPI.profitPDF(params) : await exportAPI.profitExcel(params);
      downloadBlob(res, `ProfitReport.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch { toast.error('Export failed.'); }
  }

  const records = data?.data || [];
  const summary = data?.summary || {};

  const chartData = records.map((r) => ({
    date: fmtDate(r.reportDate),
    Sales: parseFloat(r.totalSales) || 0,
    Cost: parseFloat(r.totalCost) || 0,
    Profit: parseFloat(r.totalProfit) || 0,
  }));

  return (
    <div className="space-y-4">
      {data?.complete === false && <p role="status">Unverified historical gross profit: some legacy invoices lack reliable cost snapshots.</p>}
      <PageHeader
        title="Profit & Loss Report"
        subtitle="Revenue analysis, wholesale cost of goods sold, gross margin percentage, and daily trading profits"
        badge="PROFIT & LOSS"
        badgeVariant="brand"
        actions={
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={() => exportDoc('pdf')} title="Export PDF">
              <FileDown size={14} /> PDF
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => exportDoc('excel')} title="Export Excel">
              <FileDown size={14} /> Excel
            </button>
          </div>
        }
      />

      {/* Date filter bar */}
      <div className="app-filter-bar">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'flex-end', width: '100%' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> From Date
            </label>
            <input id="rep-from" type="date" className="form-input text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> To Date
            </label>
            <input id="rep-to" type="date" className="form-input text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KpiGrid cols={4}>
        <KpiCard
          title="Total Sales"
          value={pkr(summary.totalSales)}
          caption="Gross invoiced revenue"
          icon={TrendingUp}
          accentColor="brand"
          badge="REVENUE"
        />
        <KpiCard
          title="Total Cost"
          value={pkr(summary.totalCost)}
          caption="Purchase cost of items sold"
          icon={TrendingDown}
          accentColor="rose"
          badge="COGS"
        />
        <KpiCard
          title="Gross Profit"
          value={pkr(summary.totalProfit)}
          caption="Sales minus cost of goods sold"
          icon={DollarSign}
          accentColor={parseFloat(summary.totalProfit) >= 0 ? 'emerald' : 'rose'}
          badge={parseFloat(summary.totalProfit) >= 0 ? 'PROFIT' : 'LOSS'}
        />
        <KpiCard
          title="Gross Margin %"
          value={`${summary.profitMargin || '0.0'}%`}
          caption="Turnover gross profit margin"
          icon={Percent}
          accentColor="blue"
          badge="MARGIN"
        />
      </KpiGrid>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="app-table-card">
          <div className="flex items-center justify-between p-3 border-b border-border bg-subtle">
            <span className="font-semibold text-sm">Daily Sales vs. Cost vs. Gross Profit</span>
            <span className="text-xs text-muted font-medium">{records.length} trading days</span>
          </div>
          <div className="p-4" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={80} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `Rs ${v.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Sales" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cost" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="app-table-card">
        <div className="flex items-center justify-between p-3 border-b border-border bg-subtle">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Daily Breakdown Statement</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt font-medium text-muted">
              {records.length} days
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Date</th>
                <th className="num" style={{ width: 140 }}>Total Sales</th>
                <th className="num" style={{ width: 140 }}>Total Cost</th>
                <th className="num" style={{ width: 140 }}>Gross Profit</th>
                <th className="num" style={{ width: 110 }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={5} rows={6} />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={BarChart3}
                      title="No sales data for this period"
                      description="No invoice transactions recorded in the selected date range to calculate gross profit."
                    />
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const margin = parseFloat(r.totalSales) > 0
                    ? ((parseFloat(r.totalProfit) / parseFloat(r.totalSales)) * 100).toFixed(1)
                    : '0.0';
                  const profit = parseFloat(r.totalProfit) || 0;
                  return (
                    <tr key={r.id}>
                      <td className="text-sm font-medium">{fmtDate(r.reportDate)}</td>
                      <td className="num tabular font-semibold text-text">{pkr(r.totalSales)}</td>
                      <td className="num tabular font-medium text-muted">{pkr(r.totalCost)}</td>
                      <td className="num tabular font-bold" style={{ color: profit >= 0 ? 'var(--paid)' : 'var(--alert)' }}>
                        {pkr(profit)}
                      </td>
                      <td className="num tabular font-semibold" style={{ color: profit >= 0 ? 'var(--paid)' : 'var(--alert)' }}>
                        {margin}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr style={{ background: '#1e293b', color: '#fff', fontWeight: 700 }}>
                  <td style={{ color: '#fff' }}>TOTAL FOR PERIOD</td>
                  <td className="num tabular" style={{ color: '#fff' }}>{pkr(summary.totalSales)}</td>
                  <td className="num tabular" style={{ color: '#f87171' }}>{pkr(summary.totalCost)}</td>
                  <td className="num tabular" style={{ color: '#34d399' }}>{pkr(summary.totalProfit)}</td>
                  <td className="num tabular" style={{ color: '#60a5fa' }}>{summary.profitMargin}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
