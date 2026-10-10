// ─────────────────────────────────────────────────────────────
// src/pages/TrialBalance.jsx
// Trial Balance report — all accounts with Debit/Credit columns
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, exportAPI, downloadBlob } from '../api/services';
import toast from 'react-hot-toast';
import { FileDown, FileSpreadsheet, CheckCircle, AlertTriangle, Scale, Calendar, BookOpen } from 'lucide-react';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

function fmtPKR(n) {
  return `Rs ${parseFloat(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TrialBalance() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [asOn, setAsOn] = useState(todayStr);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['trial-balance', asOn],
    queryFn: () => reportsAPI.trialBalance({ asOn }).then((r) => r.data?.data),
  });

  const rows = report?.rows || [];
  const totalDebit = report?.totalDebit || 0;
  const totalCredit = report?.totalCredit || 0;
  const isBalanced = report?.isBalanced ?? true;
  const difference = report?.difference || 0;

  // Group rows by section
  const sections = [];
  let currentSection = null;
  for (const row of rows) {
    if (!currentSection || currentSection.name !== row.section) {
      currentSection = { name: row.section, rows: [] };
      sections.push(currentSection);
    }
    currentSection.rows.push(row);
  }

  async function handleExportPDF() {
    try {
      setExportingPdf(true);
      const res = await exportAPI.trialBalancePDF({ asOn });
      downloadBlob(res, `TrialBalance-${asOn}.pdf`);
      toast.success('PDF downloaded.');
    } catch { toast.error('Failed to export PDF.'); }
    finally { setExportingPdf(false); }
  }

  async function handleExportExcel() {
    try {
      setExportingExcel(true);
      const res = await exportAPI.trialBalanceExcel({ asOn });
      downloadBlob(res, `TrialBalance-${asOn}.xlsx`);
      toast.success('Excel downloaded.');
    } catch { toast.error('Failed to export Excel.'); }
    finally { setExportingExcel(false); }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trial Balance"
        subtitle="Comprehensive general ledger audit statement verifying debit and credit equality"
        badge="FINANCIAL AUDIT"
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
            {rows.length} ledger accounts
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
              ? 'Trial Balance is BALANCED — Total Debits match Total Credits exactly.'
              : `Trial Balance is NOT BALANCED — Difference: ${fmtPKR(difference)}`}
          </span>
        </div>
      )}

      {/* KPI Summary */}
      <KpiGrid cols={4}>
        <KpiCard
          title="Total Debit (Dr)"
          value={fmtPKR(totalDebit)}
          caption="Aggregate debit ledger balances"
          icon={Scale}
          accentColor="emerald"
          badge="DR TOTAL"
        />
        <KpiCard
          title="Total Credit (Cr)"
          value={fmtPKR(totalCredit)}
          caption="Aggregate credit ledger balances"
          icon={Scale}
          accentColor="blue"
          badge="CR TOTAL"
        />
        <KpiCard
          title="Audit Difference"
          value={fmtPKR(difference)}
          caption={isBalanced ? 'Zero difference (in balance)' : 'Unreconciled discrepancy'}
          icon={isBalanced ? CheckCircle : AlertTriangle}
          accentColor={isBalanced ? 'emerald' : 'rose'}
          badge={isBalanced ? 'BALANCED' : 'IMBALANCE'}
        />
        <KpiCard
          title="Ledger Accounts"
          value={rows.length}
          caption={`${sections.length} categories classified`}
          icon={BookOpen}
          accentColor="brand"
          badge="HEADS"
        />
      </KpiGrid>

      {/* Table */}
      {isLoading ? (
        <div className="app-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Account Name</th>
                <th className="num" style={{ width: 160 }}>Debit (Rs)</th>
                <th className="num" style={{ width: 160 }}>Credit (Rs)</th>
              </tr>
            </thead>
            <tbody>
              <TableSkeleton cols={4} rows={8} />
            </tbody>
          </table>
        </div>
      ) : rows.length === 0 ? (
        <div className="app-table-card p-8">
          <EmptyState
            icon={Scale}
            title="No trial balance data"
            description="No transactions found for the selected date. Adjust the date or add transactions to populate the trial balance."
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="app-table-card desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Account Name</th>
                  <th className="num" style={{ width: 160 }}>Debit (Dr)</th>
                  <th className="num" style={{ width: 160 }}>Credit (Cr)</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <SectionGroup key={section.name} section={section} />
                ))}
                <tr style={{ fontWeight: 700, background: '#1e293b', color: '#fff' }}>
                  <td colSpan={2} style={{ color: '#fff' }}>GRAND TOTAL</td>
                  <td className="num tabular" style={{ color: '#34d399' }}>{fmtPKR(totalDebit)}</td>
                  <td className="num tabular" style={{ color: '#60a5fa' }}>{fmtPKR(totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sections.map((section) => (
              <div key={section.name} className="app-table-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  background: 'var(--subtle, #f8fafc)',
                  padding: '8px 14px',
                  fontWeight: 700,
                  fontSize: 12,
                  color: 'var(--brand)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {section.name}
                </div>
                {section.rows.map((row, i) => (
                  <div key={i} style={{
                    padding: '10px 14px',
                    borderBottom: i < section.rows.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 500, flex: 1, minWidth: 120 }}>{row.name}</span>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <span style={{ color: row.debit > 0 ? 'var(--paid)' : 'var(--text-muted)' }}>
                        DR: {row.debit > 0 ? fmtPKR(row.debit) : '—'}
                      </span>
                      <span style={{ color: row.credit > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                        CR: {row.credit > 0 ? fmtPKR(row.credit) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Mobile totals card */}
            <div className="card" style={{
              padding: '12px 14px',
              background: '#1e293b',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 700,
              fontSize: 13,
            }}>
              <span>TOTAL</span>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ color: '#34d399' }}>DR: {fmtPKR(totalDebit)}</span>
                <span style={{ color: '#60a5fa' }}>CR: {fmtPKR(totalCredit)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Sub-component for desktop table section grouping
function SectionGroup({ section }) {
  let seq = 0;
  return (
    <>
      <tr>
        <td
          colSpan={4}
          style={{
            background: 'var(--subtle, #f8fafc)',
            fontWeight: 700,
            fontSize: 12,
            color: 'var(--brand)',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {section.name}
        </td>
      </tr>
      {section.rows.map((row, i) => (
        <tr key={i}>
          <td className="text-muted text-xs">{++seq}</td>
          <td className="text-sm font-medium">{row.name}</td>
          <td className="num tabular font-semibold" style={{ color: row.debit > 0 ? 'var(--paid)' : 'var(--text-muted)' }}>
            {row.debit > 0 ? fmtPKR(row.debit) : '—'}
          </td>
          <td className="num tabular font-semibold" style={{ color: row.credit > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
            {row.credit > 0 ? fmtPKR(row.credit) : '—'}
          </td>
        </tr>
      ))}
    </>
  );
}
