// ─────────────────────────────────────────────────────────────
// src/pages/BalanceSheet.jsx
// Balance Sheet report — Assets / Liabilities / Equity
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, exportAPI, downloadBlob } from '../api/services';
import toast from 'react-hot-toast';
import { FileDown, FileSpreadsheet, CheckCircle, AlertTriangle, Sheet, Calendar, Wallet, Building2, TrendingUp } from 'lucide-react';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

function fmtPKR(n) {
  return `Rs ${parseFloat(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BalanceSheet() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [asOn, setAsOn] = useState(todayStr);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['balance-sheet', asOn],
    queryFn: () => reportsAPI.balanceSheet({ asOn }).then((r) => r.data?.data),
  });

  const assets = report?.assets || [];
  const liabilities = report?.liabilities || [];
  const equity = report?.equity || [];
  const totalAssets = report?.totalAssets || 0;
  const totalLiabilities = report?.totalLiabilities || 0;
  const totalEquity = report?.totalEquity || 0;
  const totalLE = report?.totalLiabilitiesAndEquity || 0;
  const isBalanced = report?.isBalanced ?? true;
  const difference = report?.difference || 0;

  async function handleExportPDF() {
    try {
      setExportingPdf(true);
      const res = await exportAPI.balanceSheetPDF({ asOn });
      downloadBlob(res, `BalanceSheet-${asOn}.pdf`);
      toast.success('PDF downloaded.');
    } catch { toast.error('Failed to export PDF.'); }
    finally { setExportingPdf(false); }
  }

  async function handleExportExcel() {
    try {
      setExportingExcel(true);
      const res = await exportAPI.balanceSheetExcel({ asOn });
      downloadBlob(res, `BalanceSheet-${asOn}.xlsx`);
      toast.success('Excel downloaded.');
    } catch { toast.error('Failed to export Excel.'); }
    finally { setExportingExcel(false); }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Balance Sheet"
        subtitle="Statement of financial position displaying real-time Assets, Liabilities, and Owner Equity"
        badge="FINANCIAL POSITION"
        badgeVariant="brand"
        actions={
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={handleExportPDF} disabled={exportingPdf || isLoading}>
              <FileDown size={14} /> {exportingPdf ? '...' : 'PDF'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleExportExcel} disabled={exportingExcel || isLoading}>
              <FileSpreadsheet size={14} /> {exportingExcel ? '...' : 'Excel'}
            </button>
          </div>
        }
      />

      {/* Date Filter Bar */}
      <div className="app-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', width: '100%' }}>
          <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1" style={{ marginBottom: 0 }}>
              <Calendar size={13} /> As On Date:
            </label>
            <input
              type="date"
              className="form-input text-sm"
              value={asOn}
              onChange={(e) => setAsOn(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-muted ml-auto">
            {assets.length + liabilities.length + equity.length} balance sheet line items
          </div>
        </div>
      </div>

      {/* Balance check indicator */}
      {report && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: isBalanced ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${isBalanced ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}
        >
          {isBalanced ? (
            <CheckCircle size={18} style={{ color: 'var(--paid)', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={18} style={{ color: 'var(--alert)', flexShrink: 0 }} />
          )}
          <span style={{ fontWeight: 600, fontSize: 13, color: isBalanced ? 'var(--paid)' : 'var(--alert)' }}>
            {isBalanced
              ? 'Balance Sheet is BALANCED — Total Assets equal Liabilities + Equity.'
              : `Balance Sheet is NOT BALANCED — Difference: ${fmtPKR(difference)}`}
          </span>
        </div>
      )}

      {/* KPI Summary */}
      <KpiGrid cols={3}>
        <KpiCard
          title="Total Assets"
          value={fmtPKR(totalAssets)}
          caption="Current cash, banks, inventory & receivables"
          icon={Wallet}
          accentColor="emerald"
          badge="ASSETS"
        />
        <KpiCard
          title="Total Liabilities"
          value={fmtPKR(totalLiabilities)}
          caption="Supplier payables & outstanding obligations"
          icon={Building2}
          accentColor="rose"
          badge="LIABILITIES"
        />
        <KpiCard
          title="Owner's Equity"
          value={fmtPKR(totalEquity)}
          caption="Net retained capital & business equity"
          icon={TrendingUp}
          accentColor="blue"
          badge="EQUITY"
        />
      </KpiGrid>

      {isLoading ? (
        <div className="grid-2">
          <div className="app-table-card p-6">
            <TableSkeleton cols={2} rows={5} />
          </div>
          <div className="app-table-card p-6">
            <TableSkeleton cols={2} rows={5} />
          </div>
        </div>
      ) : (
        <>
          {/* Desktop: Side-by-side panels */}
          <div className="desktop-only" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Left: Assets */}
            <div className="app-table-card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="ASSETS"
                items={assets}
                total={totalAssets}
                totalLabel="Total Assets"
                color="var(--brand)"
              />
            </div>

            {/* Right: Liabilities + Equity */}
            <div className="app-table-card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="LIABILITIES"
                items={liabilities}
                total={totalLiabilities}
                totalLabel="Total Liabilities"
                color="#dc2626"
              />
              <BSSection
                title="EQUITY"
                items={equity}
                total={totalEquity}
                totalLabel="Total Equity"
                color="#2563eb"
              />
              {/* Grand total */}
              <div style={{
                padding: '12px 16px',
                background: '#1e293b',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: 13,
              }}>
                <span>Total Liabilities + Equity</span>
                <span className="tabular font-bold" style={{ color: '#34d399' }}>{fmtPKR(totalLE)}</span>
              </div>
            </div>
          </div>

          {/* Mobile: Stacked */}
          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="app-table-card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="ASSETS"
                items={assets}
                total={totalAssets}
                totalLabel="Total Assets"
                color="var(--brand)"
              />
            </div>

            <div className="app-table-card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="LIABILITIES"
                items={liabilities}
                total={totalLiabilities}
                totalLabel="Total Liabilities"
                color="#dc2626"
              />
            </div>

            <div className="app-table-card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="EQUITY"
                items={equity}
                total={totalEquity}
                totalLabel="Total Equity"
                color="#2563eb"
              />
            </div>

            {/* Equation check */}
            <div className="card" style={{
              padding: '12px 14px',
              background: '#1e293b',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Total Assets</span>
                <span style={{ color: '#34d399' }}>{fmtPKR(totalAssets)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.9 }}>
                <span>Liabilities + Equity</span>
                <span style={{ color: '#60a5fa' }}>{fmtPKR(totalLE)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Sub-component for a balance sheet section
function BSSection({ title, items, total, totalLabel, color }) {
  return (
    <div>
      {/* Section header */}
      <div style={{
        padding: '10px 16px',
        background: color,
        color: '#fff',
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: 0.5,
      }}>
        {title}
      </div>

      {/* Items */}
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            fontSize: 13,
          }}
        >
          <span style={{ flex: 1 }}>{item.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {fmtPKR(item.amount)}
          </span>
        </div>
      ))}

      {items.length === 0 && (
        <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12, fontStyle: 'italic' }}>
          No items
        </div>
      )}

      {/* Section total */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(15, 110, 79, 0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        fontWeight: 700,
        fontSize: 13,
        color,
        borderBottom: '2px solid var(--border)',
      }}>
        <span>{totalLabel}</span>
        <span>{fmtPKR(total)}</span>
      </div>
    </div>
  );
}
