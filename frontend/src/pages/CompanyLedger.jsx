// ─────────────────────────────────────────────────────────────
// src/pages/CompanyLedger.jsx — mirrors CustomerLedger
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { companiesAPI, ledgerAPI, exportAPI, downloadBlob } from '../api/services';
import toast from 'react-hot-toast';
import { FileDown } from 'lucide-react';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-PK') : '—'; }

export default function CompanyLedger() {
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: compData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesAPI.list({ limit: 500 }).then((r) => r.data.data),
  });

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['company-ledger', companyId, from, to],
    queryFn: () => ledgerAPI.company(companyId, { from, to }).then((r) => r.data.data),
    enabled: !!companyId,
  });

  async function exportDoc(fmt) {
    if (!companyId) return;
    try {
      const params = { ...(from && { from }), ...(to && { to }) };
      const res = fmt === 'pdf'
        ? await exportAPI.companyLedgerPDF(companyId, params)
        : await exportAPI.companyLedgerExcel(companyId, params);
      const comp = companies.find((c) => c.id === companyId);
      downloadBlob(res, `CompanyLedger-${comp?.companyName || 'export'}.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch { toast.error('Export failed.'); }
  }

  const companies = compData || [];
  const transactions = ledger?.transactions || [];
  const summary = ledger?.summary || {};
  const selectedCompany = companies.find((c) => c.id === companyId);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Company / Distributor Ledger</h2>
        {companyId && (
          <div className="flex gap-8">
            <button className="btn btn-outline btn-sm" onClick={() => exportDoc('pdf')}><FileDown size={13} /> PDF</button>
            <button className="btn btn-outline btn-sm" onClick={() => exportDoc('excel')}><FileDown size={13} /> Excel</button>
          </div>
        )}
      </div>

      <div className="card card-body" style={{ marginBottom: 14 }}>
        <div className="grid-3" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Company *</label>
            <select id="coml-company" className="form-select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">— Select Company —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input id="coml-from" type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input id="coml-to" type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {companyId && summary.closingBalance !== undefined && (
        <div className="kpi-grid" style={{ marginBottom: 14 }}>
          <div className="kpi-card">
            <div className="kpi-label">Total Debit (Dr)</div>
            <div className="kpi-value color-alert tabular">{pkr(summary.totalDebit)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Credit (Cr)</div>
            <div className="kpi-value color-brand tabular">{pkr(summary.totalCredit)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Closing Balance</div>
            <div className={`kpi-value tabular ${parseFloat(summary.closingBalance) > 0 ? 'color-alert' : 'color-brand'}`}>
              {pkr(summary.closingBalance)}
            </div>
          </div>
          {selectedCompany && (
            <div className="kpi-card">
              <div className="kpi-label">{selectedCompany.companyName}</div>
              <div className="text-muted text-sm">{selectedCompany.phone || '—'}</div>
            </div>
          )}
        </div>
      )}

      {companyId ? (
        <div className="card">
          <div className="card-header">
            <span>Ledger Transactions</span>
            <span className="text-muted text-sm">{transactions.length} entries</span>
          </div>
          <div className="data-table-wrap" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Ref Type</th>
                  <th className="num">Debit (Dr)</th>
                  <th className="num">Credit (Cr)</th>
                  <th className="num">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No transactions found</td></tr>
                ) : transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.transactionDate)}</td>
                    <td>{t.description}</td>
                    <td><span className="badge badge-brand" style={{ fontSize: 10 }}>{t.referenceType}</span></td>
                    <td className="num tabular" style={{ color: parseFloat(t.debit) > 0 ? 'var(--alert)' : 'var(--text-muted)' }}>
                      {parseFloat(t.debit) > 0 ? pkr(t.debit) : '—'}
                    </td>
                    <td className="num tabular" style={{ color: parseFloat(t.credit) > 0 ? 'var(--paid)' : 'var(--text-muted)' }}>
                      {parseFloat(t.credit) > 0 ? pkr(t.credit) : '—'}
                    </td>
                    <td className="num tabular" style={{ fontWeight: 600, color: parseFloat(t.runningBalance) > 0 ? 'var(--alert)' : 'var(--brand)' }}>
                      {pkr(t.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state"><p>Select a company above to view their ledger</p></div>
      )}
    </div>
  );
}
