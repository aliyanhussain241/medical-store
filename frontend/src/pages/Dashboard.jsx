// ─────────────────────────────────────────────────────────────
// src/pages/Dashboard.jsx
// KPI cards with trend badges + recent invoices + overdue customers
// ─────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '../api/services';
import {
  TrendingUp, DollarSign, AlertCircle, Package, ArrowUpRight,
  CheckCircle2, FileText, AlertTriangle, Clock
} from 'lucide-react';

function pkr(v) {
  return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
}
function statusBadge(s) {
  const map = { PAID: 'paid', PENDING: 'pending', PARTIAL: 'partial', OVERDUE: 'overdue' };
  return <span className={`badge badge-${map[s] || 'pending'}`}>{s}</span>;
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardAPI.stats().then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-title">Dashboard</h2>
          <span className="text-muted">Loading business metrics...</span>
        </div>
        <div className="kpi-grid">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="kpi-card">
              <div className="skeleton skeleton-text" style={{ width: '55%', height: 12 }} />
              <div className="skeleton skeleton-text" style={{ width: '85%', height: 26, marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div className="dashboard-panels">
          <div className="card">
            <div className="card-header">
              <div className="skeleton skeleton-text" style={{ width: 130, height: 14 }} />
            </div>
            <div className="card-body">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton skeleton-text" style={{ height: 28, margin: '8px 0' }} />
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="skeleton skeleton-text" style={{ width: 170, height: 14 }} />
            </div>
            <div className="card-body">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton skeleton-text" style={{ height: 28, margin: '8px 0' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const d = data || {};

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <span className="text-muted">Live business summary</span>
      </div>

      {/* KPI Cards with Trend Indicators */}
      <div className="kpi-grid">
        <div className="kpi-card brand">
          <div className="kpi-header">
            <span className="kpi-label">Today's Sales</span>
            <span className="kpi-trend up">
              <TrendingUp size={11} /> Today
            </span>
          </div>
          <div className="kpi-value">{pkr(d.todaySales)}</div>
        </div>

        <div className="kpi-card brand">
          <div className="kpi-header">
            <span className="kpi-label">Today's Profit</span>
            <span className="kpi-trend up">
              <ArrowUpRight size={11} /> Margin
            </span>
          </div>
          <div className="kpi-value">{pkr(d.todayProfit)}</div>
        </div>

        <div className="kpi-card accent">
          <div className="kpi-header">
            <span className="kpi-label">Total Receivables</span>
            <span className="kpi-trend neutral">
              <Clock size={11} /> Receivable
            </span>
          </div>
          <div className="kpi-value">{pkr(d.totalReceivables)}</div>
        </div>

        <div className="kpi-card accent">
          <div className="kpi-header">
            <span className="kpi-label">Total Payables</span>
            <span className="kpi-trend neutral">
              <Clock size={11} /> Payable
            </span>
          </div>
          <div className="kpi-value">{pkr(d.totalPayables)}</div>
        </div>

        <div className={`kpi-card ${d.lowStockCount > 0 ? 'alert' : ''}`}>
          <div className="kpi-header">
            <span className="kpi-label">Low Stock Items</span>
            <span className={`kpi-trend ${d.lowStockCount > 0 ? 'down' : 'up'}`}>
              {d.lowStockCount > 0 ? <AlertCircle size={11} /> : <CheckCircle2 size={11} />}
              {d.lowStockCount > 0 ? 'Reorder' : 'Optimal'}
            </span>
          </div>
          <div className="kpi-value">{d.lowStockCount}</div>
        </div>
      </div>

      <div className="dashboard-panels">
        {/* Recent Invoices */}
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileText size={15} color="var(--brand)" /> Recent Invoices
            </span>
          </div>
          <div className="data-table-wrap" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(d.recentInvoices || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                      No invoices yet
                    </td>
                  </tr>
                ) : (
                  (d.recentInvoices || []).map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.invoiceNo}</td>
                      <td>{inv.customer?.customerName}</td>
                      <td className="num tabular">{pkr(inv.totalAmount)}</td>
                      <td>{statusBadge(inv.paymentStatus)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overdue Customers */}
        <div className="card">
          <div className="card-header">
            <span style={{ color: 'var(--alert)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} /> Customers with Outstanding Balance
            </span>
          </div>
          <div className="data-table-wrap" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Shop</th>
                  <th className="num">Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {(d.overdueCustomers || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                      All customer accounts are clear
                    </td>
                  </tr>
                ) : (
                  (d.overdueCustomers || []).map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.customerName}</td>
                      <td className="text-muted">{c.shopName || '—'}</td>
                      <td className="num tabular" style={{ color: 'var(--alert)', fontWeight: 700 }}>
                        {pkr(c.currentBalance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
