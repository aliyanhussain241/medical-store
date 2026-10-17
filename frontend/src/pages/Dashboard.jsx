// ─────────────────────────────────────────────────────────────
// src/pages/Dashboard.jsx
// StoreOS Dashboard — redesigned to match reference card style
// Sections: Quick Actions → Financial Health → Profitability
//           → Cash Flow → Bank & Ledger Liquidity → Tables
// ─────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../api/services';
import {
  ShoppingCart, Truck, Package, Users, TrendingUp, TrendingDown,
  DollarSign, AlertCircle, CheckCircle2, FileText, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, Building2, Wallet, BarChart3,
  Activity, Clock, ChevronRight
} from 'lucide-react';

// ── Formatters ────────────────────────────────────────────────
function pkr(v, decimals = 2) {
  const n = parseFloat(v || 0);
  return `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
function pkrShort(v) {
  const n = parseFloat(v || 0);
  if (n >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rs ${(n / 1_000).toFixed(1)}K`;
  return `Rs ${n.toFixed(0)}`;
}
function statusBadge(s) {
  const map = { PAID: 'paid', PENDING: 'pending', PARTIAL: 'partial', OVERDUE: 'overdue' };
  return <span className={`badge badge-${map[s] || 'pending'}`}>{s}</span>;
}

// ── Section Header ────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, color = 'var(--brand)' }) {
  return (
    <div className="db-section-header">
      <Icon size={14} color={color} />
      <span className="db-section-label">{label}</span>
    </div>
  );
}

// ── Quick Action Card ─────────────────────────────────────────
function QuickCard({ icon: Icon, iconBg, iconColor, title, subtitle, onClick }) {
  return (
    <button className="db-quick-card" onClick={onClick} type="button">
      <div className="db-quick-icon" style={{ background: iconBg }}>
        <Icon size={22} color={iconColor} />
      </div>
      <div className="db-quick-text">
        <div className="db-quick-title">{title}</div>
        <div className="db-quick-sub">{subtitle}</div>
      </div>
    </button>
  );
}

// ── KPI Health Card ───────────────────────────────────────────
function HealthCard({ icon: Icon, iconBg, iconColor, badge, badgeColor, value, subtitle, borderColor }) {
  return (
    <div className="db-health-card" style={{ '--hc-border': borderColor }}>
      <div className="db-health-top">
        <div className="db-health-icon" style={{ background: iconBg }}>
          <Icon size={18} color={iconColor} />
        </div>
        <span className="db-health-badge" style={{ color: badgeColor, background: `${badgeColor}18` }}>
          {badge}
        </span>
      </div>
      <div className="db-health-value">{value}</div>
      <div className="db-health-sub">{subtitle}</div>
    </div>
  );
}

// ── Cash Flow Card ────────────────────────────────────────────
function CashFlowCard({ icon: Icon, iconColor, badge, badgeColor, borderColor, bigValue, bigLabel, smallLabel, smallValue }) {
  return (
    <div className="db-cashflow-card" style={{ '--cf-border': borderColor }}>
      <div className="db-cashflow-top">
        <Icon size={22} color={iconColor} />
        <span className="db-health-badge" style={{ color: badgeColor, background: `${badgeColor}18` }}>
          {badge}
        </span>
      </div>
      <div className="db-cashflow-value">{bigValue}</div>
      <div className="db-cashflow-label">{bigLabel}</div>
      <div className="db-cashflow-overall">{smallLabel}: <strong>{smallValue}</strong></div>
    </div>
  );
}

// ── Bank Card ─────────────────────────────────────────────────
function BankCard({ type, name, balance, onLedger, highlight }) {
  if (highlight) {
    return (
      <div className="db-bank-card db-bank-highlight">
        <div className="db-bank-top">
          <div className="db-bank-icon db-bank-icon-light">
            <Wallet size={18} color="#fff" />
          </div>
          <span className="db-bank-badge db-bank-badge-light">TOTAL CASH</span>
        </div>
        <div className="db-bank-balance-highlight">{pkr(balance)}</div>
        <div className="db-bank-name-light">{name}</div>
        <div className="db-bank-sub-light">Active Liquid Funds</div>
      </div>
    );
  }
  return (
    <div className="db-bank-card">
      <div className="db-bank-top">
        <div className="db-bank-icon" style={{ background: '#EEF2FF' }}>
          <Building2 size={16} color="#6366F1" />
        </div>
        <span className="db-bank-badge">{type}</span>
      </div>
      <div className="db-bank-balance">{pkr(balance)}</div>
      <div className="db-bank-name">{name}</div>
      <div className="db-bank-footer">
        <span className="db-bank-sub">Account Balance</span>
        {onLedger && (
          <button className="db-bank-ledger-btn" onClick={onLedger} type="button">
            Ledger <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Profit Bar ────────────────────────────────────────────────
function ProfitBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (parseFloat(value) / max) * 100) : 0;
  return (
    <div className="db-profit-bar-row">
      <div className="db-profit-bar-label">{label}</div>
      <div className="db-profit-bar-track">
        <div className="db-profit-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="db-profit-bar-val">{pkr(value)}</div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────
function DashSkeleton() {
  return (
    <div className="db-root">
      <div className="db-welcome">
        <div className="skeleton" style={{ width: 220, height: 20, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 120, height: 13, borderRadius: 6, marginTop: 6 }} />
      </div>
      <div className="db-quick-row">
        {[1,2,3,4].map(i => <div key={i} className="db-quick-card skeleton" style={{ height: 90 }} />)}
      </div>
      <div className="db-health-grid">
        {[1,2,3,4].map(i => <div key={i} className="db-health-card skeleton" style={{ height: 110 }} />)}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardAPI.stats().then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <DashSkeleton />;
  if (isError) return <div role="alert">Dashboard data could not be loaded. <button className="btn btn-outline" onClick={() => refetch()}>Retry</button></div>;

  const d = data || {};
  const bankAccounts = d.bankAccounts || [];
  const todayRevenue = parseFloat(d.todayRevenue || d.todaySales || 0);
  const todayCOGS = parseFloat(d.todayCOGS || 0);
  const todayProfit = parseFloat(d.todayProfit || 0);
  const maxBar = Math.max(todayRevenue, todayCOGS, 1);

  const today = new Date().toLocaleDateString('en-PK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="db-root">
      {d.complete === false && <p role="status">Unverified historical figures: some cost or opening-balance evidence is missing.</p>}

      {/* ── Welcome Banner ───────────────────────────────── */}
      <div className="db-welcome">
        <div className="db-welcome-inner">
          <div>
            <h2 className="db-welcome-title">Welcome Back! 👋</h2>
            <p className="db-welcome-sub">Live business diagnostic — {today}</p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div className="db-quick-row">
        <QuickCard
          icon={ShoppingCart}
          iconBg="#DCFCE7" iconColor="#16A34A"
          title="New Invoice"
          subtitle="Create customer sale"
          onClick={() => navigate('/invoices/new')}
        />
        <QuickCard
          icon={Truck}
          iconBg="#DBEAFE" iconColor="#2563EB"
          title="New Purchase"
          subtitle="Record stock purchase"
          onClick={() => navigate('/purchases/new')}
        />
        <QuickCard
          icon={Package}
          iconBg="#FEF3C7" iconColor="#D97706"
          title="Inventory"
          subtitle="View & manage stock"
          onClick={() => navigate('/products')}
        />
        <QuickCard
          icon={Users}
          iconBg="#F3E8FF" iconColor="#9333EA"
          title="Customers"
          subtitle="Manage customer list"
          onClick={() => navigate('/customers')}
        />
      </div>

      {/* ── Financial Health ──────────────────────────────── */}
      <SectionHeader icon={Activity} label="FINANCIAL HEALTH (TODAY)" color="#16A34A" />
      <div className="db-health-grid">
        <HealthCard
          icon={ShoppingCart}
          iconBg="#DCFCE7" iconColor="#16A34A"
          badge="SALES" badgeColor="#16A34A"
          borderColor="#16A34A"
          value={pkr(d.todaySales)}
          subtitle="Today's Sales Revenue"
        />
        <HealthCard
          icon={Truck}
          iconBg="#DBEAFE" iconColor="#2563EB"
          badge="OPERATIONS" badgeColor="#2563EB"
          borderColor="#2563EB"
          value={pkr(d.todayPurchases)}
          subtitle="Today's Purchase"
        />
        <HealthCard
          icon={FileText}
          iconBg="#FEF3C7" iconColor="#D97706"
          badge="LIABILITIES" badgeColor="#D97706"
          borderColor="#D97706"
          value={pkr(d.totalPayables)}
          subtitle="Total Payables"
        />
        <HealthCard
          icon={AlertCircle}
          iconBg="#F3E8FF" iconColor="#9333EA"
          badge="LIABILITIES" badgeColor="#9333EA"
          borderColor="#9333EA"
          value={pkr(d.totalReceivables)}
          subtitle="Total Receivables (Customer Credit)"
        />
      </div>

      {/* ── Profitability & Performance ───────────────────── */}
      <SectionHeader icon={BarChart3} label="PROFITABILITY & PERFORMANCE (TODAY)" color="#0F6E4F" />
      <div className="db-profit-grid">
        {/* Net Profit Breakdown Card */}
        <div className="db-profit-breakdown">
          <div className="db-profit-card-header">
            <div className="db-profit-dot" style={{ background: '#0F6E4F' }} />
            <span className="db-profit-card-title">Net Profit Breakdown</span>
          </div>
          <div className="db-profit-center">
            <div className="db-profit-label">NET PROFIT</div>
            <div className="db-profit-big" style={{ color: todayProfit >= 0 ? '#0F6E4F' : '#DC2626' }}>
              {pkr(todayProfit)}
            </div>
            <div className="db-profit-desc">Net Revenue minus Cost of Goods Sold</div>
          </div>
          <div className="db-profit-bars">
            <ProfitBar label="Net Revenue" value={todayRevenue} max={maxBar} color="#0F6E4F" />
            <ProfitBar label="Cost of Goods Sold (COGS)" value={todayCOGS} max={maxBar} color="#DC2626" />
          </div>
        </div>

        {/* Revenue vs Cost Chart (visual bar blocks) */}
        <div className="db-profit-chart-card">
          <div className="db-profit-card-header">
            <BarChart3 size={14} color="#0F6E4F" />
            <span className="db-profit-card-title">Revenue vs Cost vs Net Profit</span>
          </div>
          <div className="db-chart-bars">
            {[
              { label: 'Revenue', value: todayRevenue, color: '#0F6E4F' },
              { label: 'Cost', value: todayCOGS, color: '#EF4444' },
              { label: 'Net Profit', value: Math.max(0, todayProfit), color: '#3B82F6' },
            ].map(({ label, value, color }) => {
              const pct = maxBar > 0 ? Math.max(4, (value / maxBar) * 100) : 4;
              return (
                <div key={label} className="db-chart-col">
                  <div className="db-chart-bar-wrap">
                    <div className="db-chart-bar" style={{ height: `${pct}%`, background: color }} />
                  </div>
                  <div className="db-chart-bar-val">{pkrShort(value)}</div>
                  <div className="db-chart-bar-label">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Cash Flow & Payments ──────────────────────────── */}
      <SectionHeader icon={TrendingUp} label="CASH FLOW & PAYMENTS (TODAY)" color="#2563EB" />
      <div className="db-cashflow-grid">
        <CashFlowCard
          icon={ArrowDownCircle} iconColor="#2563EB"
          badge="RECEIPTS" badgeColor="#2563EB"
          borderColor="#2563EB"
          bigValue={pkr(d.paymentInToday)}
          bigLabel="Payment In (Today)"
          smallLabel="Overall Received"
          smallValue={pkr(d.overallReceived)}
        />
        <CashFlowCard
          icon={ArrowUpCircle} iconColor="#EF4444"
          badge="PAYMENTS" badgeColor="#EF4444"
          borderColor="#EF4444"
          bigValue={pkr(d.paymentOutToday)}
          bigLabel="Payment Out (Today)"
          smallLabel="Overall Settled"
          smallValue={pkr(d.overallSettled)}
        />
      </div>

      {/* ── Bank & Ledger Liquidity ───────────────────────── */}
      <SectionHeader icon={Building2} label="BANK & LEDGER LIQUIDITY" color="#6366F1" />
      <div className="db-bank-grid">
        {/* Cash in Hand */}
        <BankCard
          type="CASH"
          name="Cash in Hand"
          balance={d.cashInHand || 0}
        />
        {/* Bank Accounts */}
        {bankAccounts.map((b) => (
          <BankCard
            key={b.id}
            type="BANK"
            name={b.name || b.bank}
            balance={b.balance}
            onLedger={() => navigate(`/bank-book?account=${b.id}`)}
          />
        ))}
        {/* Combined highlight card */}
        <BankCard
          highlight
          name="Combined Cash & Bank Assets"
          balance={d.combinedLiquidity || 0}
        />
      </div>

      {/* ── Tables Row ───────────────────────────────────── */}
      <div className="db-tables-grid">
        {/* Recent Invoices */}
        <div className="db-table-card">
          <div className="db-table-header">
            <FileText size={14} color="var(--brand)" />
            <span>Recent Invoices</span>
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

        {/* Outstanding Customers */}
        <div className="db-table-card">
          <div className="db-table-header">
            <AlertTriangle size={14} color="var(--alert)" />
            <span style={{ color: 'var(--alert)' }}>Outstanding Balances</span>
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
                      All accounts are clear ✓
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
