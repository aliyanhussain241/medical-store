// ─────────────────────────────────────────────────────────────
// src/pages/CompanyLedger.jsx — mirrors CustomerLedger
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { companiesAPI, ledgerAPI, exportAPI, downloadBlob } from '../api/services';
import toast from 'react-hot-toast';
import { FileDown, Building2, TrendingUp, TrendingDown, Wallet, BookOpen, Calendar } from 'lucide-react';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

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
    <div className="space-y-4">
      <PageHeader
        title="Company / Distributor Ledger"
        subtitle="Track supplier purchases, payments, payable balances, and statement exports"
        badge={selectedCompany ? selectedCompany.companyName : undefined}
        badgeVariant="brand"
        actions={
          companyId && (
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => exportDoc('pdf')} title="Export PDF">
                <FileDown size={14} /> PDF
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => exportDoc('excel')} title="Export Excel">
                <FileDown size={14} /> Excel
              </button>
            </div>
          )
        }
      />

      {/* Filter Bar */}
      <div className="app-filter-bar">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'flex-end', width: '100%' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Building2 size={12} /> Company / Distributor *
            </label>
            <select
              id="coml-company"
              className="form-select text-sm font-medium"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">— Select Company ({companies.length}) —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> From Date
            </label>
            <input id="coml-from" type="date" className="form-input text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> To Date
            </label>
            <input id="coml-to" type="date" className="form-input text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      {companyId && summary.closingBalance !== undefined && (
        <KpiGrid cols={3}>
          <KpiCard
            title="Total Debit (Dr)"
            value={pkr(summary.totalDebit)}
            caption="Payments made to supplier"
            icon={TrendingDown}
            accentColor="emerald"
            badge="PAYMENTS"
          />
          <KpiCard
            title="Total Credit (Cr)"
            value={pkr(summary.totalCredit)}
            caption="Purchases / stock billed"
            icon={TrendingUp}
            accentColor="rose"
            badge="PURCHASES"
          />
          <KpiCard
            title="Closing Balance"
            value={pkr(summary.closingBalance)}
            caption={parseFloat(summary.closingBalance) > 0 ? 'Payable balance due' : 'Advance / zero balance'}
            icon={Wallet}
            accentColor={parseFloat(summary.closingBalance) > 0 ? 'rose' : 'emerald'}
            badge={parseFloat(summary.closingBalance) > 0 ? 'PAYABLE' : 'CLEAR'}
          />
        </KpiGrid>
      )}

      {/* Transactions Table */}
      {companyId ? (
        <div className="app-table-card">
          <div className="flex items-center justify-between p-3 border-b border-border bg-subtle">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Statement Ledger</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt font-medium text-muted">
                {transactions.length} entries
              </span>
            </div>
            {selectedCompany && (
              <span className="text-xs text-muted font-medium">
                Showing ledger for {selectedCompany.companyName}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Date</th>
                  <th>Description</th>
                  <th style={{ width: 110 }}>Ref Type</th>
                  <th className="num" style={{ width: 140 }}>Debit (Dr)</th>
                  <th className="num" style={{ width: 140 }}>Credit (Cr)</th>
                  <th className="num" style={{ width: 150 }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton cols={6} rows={6} />
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <EmptyState
                        icon={BookOpen}
                        title="No transactions found"
                        description="There are no debit or credit transactions recorded for this company in the selected date range."
                      />
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const dr = parseFloat(t.debit) || 0;
                    const cr = parseFloat(t.credit) || 0;
                    const bal = parseFloat(t.runningBalance) || 0;
                    return (
                      <tr key={t.id}>
                        <td className="text-sm font-medium">{fmtDate(t.transactionDate)}</td>
                        <td className="text-sm">{t.description}</td>
                        <td>
                          <span className="badge badge-brand text-xs font-semibold tracking-wider">
                            {t.referenceType}
                          </span>
                        </td>
                        <td className="num tabular font-semibold" style={{ color: dr > 0 ? 'var(--alert)' : 'var(--text-muted)' }}>
                          {dr > 0 ? pkr(dr) : '—'}
                        </td>
                        <td className="num tabular font-semibold" style={{ color: cr > 0 ? 'var(--paid)' : 'var(--text-muted)' }}>
                          {cr > 0 ? pkr(cr) : '—'}
                        </td>
                        <td className="num tabular font-bold" style={{ color: bal > 0 ? 'var(--alert)' : 'var(--brand)' }}>
                          {pkr(bal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="app-table-card p-8">
          <EmptyState
            icon={BookOpen}
            title="Select a Company / Distributor"
            description="Choose a company from the dropdown above to view purchase records, payment credits, and running balance."
          />
        </div>
      )}
    </div>
  );
}
