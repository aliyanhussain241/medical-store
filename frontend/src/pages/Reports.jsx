// ─────────────────────────────────────────────────────────────
// src/pages/Reports.jsx — Profit & Loss Report with chart
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, exportAPI, downloadBlob } from '../api/services';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';
import { FileDown } from 'lucide-react';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) : '—'; }

// Default to current month
const today = new Date();
const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
const defaultTo = today.toISOString().split('T')[0];

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
    Sales: parseFloat(r.totalSales),
    Cost: parseFloat(r.totalCost),
    Profit: parseFloat(r.totalProfit),
  }));

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Profit & Loss Report</h2>
        <div className="flex gap-8">
          <button className="btn btn-outline btn-sm" onClick={() => exportDoc('pdf')}><FileDown size={13} /> PDF</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportDoc('excel')}><FileDown size={13} /> Excel</button>
        </div>
      </div>

      {/* Date filter */}
      <div className="card card-body" style={{ marginBottom: 14 }}>
        <div className="date-filter-row">
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input id="rep-from" type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date</label>
            <input id="rep-to" type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        <div className="kpi-card brand">
          <div className="kpi-label">Total Sales</div>
          <div className="kpi-value tabular">{pkr(summary.totalSales)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Cost</div>
          <div className="kpi-value tabular color-alert">{pkr(summary.totalCost)}</div>
        </div>
        <div className="kpi-card brand">
          <div className="kpi-label">Gross Profit</div>
          <div className="kpi-value tabular">{pkr(summary.totalProfit)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Profit Margin</div>
          <div className="kpi-value">{summary.profitMargin || '0.0'}%</div>
        </div>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">Daily Sales vs. Cost vs. Profit</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={80} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `Rs ${v.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Sales" fill="#1B4B91" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Cost" fill="#B4372B" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Profit" fill="#0F6E4F" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="card-header">
          Daily Breakdown
          <span className="text-muted text-sm">{records.length} days</span>
        </div>
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Total Sales</th>
                <th className="num">Total Cost</th>
                <th className="num">Gross Profit</th>
                <th className="num">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No sales data for this period</td></tr>
              ) : records.map((r) => {
                const margin = parseFloat(r.totalSales) > 0
                  ? ((parseFloat(r.totalProfit) / parseFloat(r.totalSales)) * 100).toFixed(1)
                  : '0.0';
                return (
                  <tr key={r.id}>
                    <td>{fmtDate(r.reportDate)}</td>
                    <td className="num tabular">{pkr(r.totalSales)}</td>
                    <td className="num tabular">{pkr(r.totalCost)}</td>
                    <td className="num tabular" style={{ fontWeight: 600, color: parseFloat(r.totalProfit) > 0 ? 'var(--brand)' : 'var(--alert)' }}>
                      {pkr(r.totalProfit)}
                    </td>
                    <td className="num tabular">{margin}%</td>
                  </tr>
                );
              })}
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr style={{ background: '#F1F4F2', fontWeight: 700 }}>
                  <td>TOTAL</td>
                  <td className="num tabular">{pkr(summary.totalSales)}</td>
                  <td className="num tabular">{pkr(summary.totalCost)}</td>
                  <td className="num tabular" style={{ color: 'var(--brand)' }}>{pkr(summary.totalProfit)}</td>
                  <td className="num tabular">{summary.profitMargin}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
