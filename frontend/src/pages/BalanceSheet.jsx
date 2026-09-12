// ─────────────────────────────────────────────────────────────
// src/pages/BalanceSheet.jsx
// Balance Sheet report — Assets / Liabilities / Equity
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, exportAPI, downloadBlob } from '../api/services';
import toast from 'react-hot-toast';
import { FileDown, FileSpreadsheet, CheckCircle, AlertTriangle, Sheet } from 'lucide-react';

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
    <div>
      {/* Page header */}
      <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sheet size={20} style={{ color: 'var(--brand)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Balance Sheet</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>As On Date:</label>
            <input
              type="date"
              className="input"
              value={asOn}
              onChange={(e) => setAsOn(e.target.value)}
              style={{ width: 150 }}
            />
            <button className="btn btn-outline lbl" onClick={handleExportPDF} disabled={exportingPdf || isLoading}>
              <FileDown size={14} /> {exportingPdf ? '...' : 'PDF'}
            </button>
            <button className="btn btn-outline lbl" onClick={handleExportExcel} disabled={exportingExcel || isLoading}>
              <FileSpreadsheet size={14} /> {exportingExcel ? '...' : 'Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Balance check indicator */}
      {report && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: isBalanced ? 'rgba(22, 101, 52, 0.08)' : 'rgba(180, 55, 43, 0.08)',
            border: `1px solid ${isBalanced ? 'rgba(22, 101, 52, 0.25)' : 'rgba(180, 55, 43, 0.25)'}`,
          }}
        >
          {isBalanced ? (
            <CheckCircle size={20} style={{ color: '#166534', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={20} style={{ color: '#B4372B', flexShrink: 0 }} />
          )}
          <span style={{ fontWeight: 600, fontSize: 13, color: isBalanced ? '#166534' : '#B4372B' }}>
            {isBalanced
              ? '✓ Balance Sheet is BALANCED — Assets = Liabilities + Equity'
              : `⚠ Balance Sheet is NOT BALANCED — Difference: ${fmtPKR(difference)}`}
          </span>
        </div>
      )}

      {/* KPI Summary */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Assets</div>
          <div className="kpi-value" style={{ color: 'var(--brand)' }}>{fmtPKR(totalAssets)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Liabilities</div>
          <div className="kpi-value" style={{ color: '#B4372B' }}>{fmtPKR(totalLiabilities)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Owner's Equity</div>
          <div className="kpi-value" style={{ color: '#1B4B91' }}>{fmtPKR(totalEquity)}</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Desktop: Side-by-side panels */}
          <div className="desktop-only" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Left: Assets */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="ASSETS"
                items={assets}
                total={totalAssets}
                totalLabel="Total Assets"
                color="var(--brand)"
              />
            </div>

            {/* Right: Liabilities + Equity */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="LIABILITIES"
                items={liabilities}
                total={totalLiabilities}
                totalLabel="Total Liabilities"
                color="#B4372B"
              />
              <BSSection
                title="EQUITY"
                items={equity}
                total={totalEquity}
                totalLabel="Total Equity"
                color="#1B4B91"
              />
              {/* Grand total */}
              <div style={{
                padding: '10px 16px',
                background: 'var(--brand)',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: 13,
              }}>
                <span>Liabilities + Equity</span>
                <span>{fmtPKR(totalLE)}</span>
              </div>
            </div>
          </div>

          {/* Mobile: Stacked */}
          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="ASSETS"
                items={assets}
                total={totalAssets}
                totalLabel="Total Assets"
                color="var(--brand)"
              />
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="LIABILITIES"
                items={liabilities}
                total={totalLiabilities}
                totalLabel="Total Liabilities"
                color="#B4372B"
              />
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <BSSection
                title="EQUITY"
                items={equity}
                total={totalEquity}
                totalLabel="Total Equity"
                color="#1B4B91"
              />
            </div>

            {/* Equation check */}
            <div className="card" style={{
              padding: '12px 14px',
              background: 'var(--brand)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Total Assets</span>
                <span>{fmtPKR(totalAssets)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.85 }}>
                <span>Liabilities + Equity</span>
                <span>{fmtPKR(totalLE)}</span>
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
