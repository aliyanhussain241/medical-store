// ─────────────────────────────────────────────────────────────
// src/pages/TrialBalance.jsx
// Trial Balance report — all accounts with Debit/Credit columns
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, exportAPI, downloadBlob } from '../api/services';
import toast from 'react-hot-toast';
import { FileDown, FileSpreadsheet, CheckCircle, AlertTriangle, Scale } from 'lucide-react';

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
    <div>
      {/* Page header */}
      <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Scale size={20} style={{ color: 'var(--brand)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Trial Balance</h2>
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
              ? '✓ Trial Balance is BALANCED — Debit and Credit totals match.'
              : `⚠ Trial Balance is NOT BALANCED — Difference: ${fmtPKR(difference)}`}
          </span>
        </div>
      )}

      {/* KPI Summary */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Debit</div>
          <div className="kpi-value" style={{ color: 'var(--brand)' }}>{fmtPKR(totalDebit)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Credit</div>
          <div className="kpi-value" style={{ color: '#1B4B91' }}>{fmtPKR(totalCredit)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Difference</div>
          <div className="kpi-value" style={{ color: isBalanced ? '#166534' : '#B4372B' }}>{fmtPKR(difference)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Accounts</div>
          <div className="kpi-value">{rows.length}</div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div className="spinner" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          No data found for the selected date.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="table-wrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Account Name</th>
                  <th style={{ textAlign: 'right', width: 160 }}>Debit (Rs)</th>
                  <th style={{ textAlign: 'right', width: 160 }}>Credit (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <SectionGroup key={section.name} section={section} />
                ))}
                <tr style={{ fontWeight: 700, background: 'var(--brand)', color: '#fff' }}>
                  <td colSpan={2}>TOTAL</td>
                  <td style={{ textAlign: 'right' }}>{fmtPKR(totalDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtPKR(totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sections.map((section) => (
              <div key={section.name} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  background: 'rgba(15, 110, 79, 0.08)',
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
                      <span style={{ color: row.debit > 0 ? 'var(--brand)' : 'var(--text-secondary)' }}>
                        DR: {row.debit > 0 ? fmtPKR(row.debit) : '—'}
                      </span>
                      <span style={{ color: row.credit > 0 ? '#1B4B91' : 'var(--text-secondary)' }}>
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
              background: 'var(--brand)',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 700,
              fontSize: 13,
            }}>
              <span>TOTAL</span>
              <div style={{ display: 'flex', gap: 16 }}>
                <span>DR: {fmtPKR(totalDebit)}</span>
                <span>CR: {fmtPKR(totalCredit)}</span>
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
            background: 'rgba(15, 110, 79, 0.06)',
            fontWeight: 700,
            fontSize: 12,
            color: 'var(--brand)',
            padding: '6px 12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {section.name}
        </td>
      </tr>
      {section.rows.map((row, i) => (
        <tr key={i}>
          <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{++seq}</td>
          <td>{row.name}</td>
          <td style={{ textAlign: 'right', color: row.debit > 0 ? 'var(--brand)' : 'var(--text-secondary)' }}>
            {row.debit > 0 ? fmtPKR(row.debit) : '—'}
          </td>
          <td style={{ textAlign: 'right', color: row.credit > 0 ? '#1B4B91' : 'var(--text-secondary)' }}>
            {row.credit > 0 ? fmtPKR(row.credit) : '—'}
          </td>
        </tr>
      ))}
    </>
  );
}
