// ─────────────────────────────────────────────────────────────
// src/pages/CustomerLedger.jsx
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersAPI, ledgerAPI, exportAPI, downloadBlob, citiesAPI } from '../api/services';
import toast from 'react-hot-toast';
import { FileDown, Users, TrendingUp, TrendingDown, Wallet, BookOpen, Calendar, MapPin } from 'lucide-react';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-PK') : '—'; }

export default function CustomerLedger() {
  const [areaFilter, setAreaFilter] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: custData } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersAPI.list({ limit: 500 }).then((r) => r.data.data),
  });

  const { data: managedCitiesData } = useQuery({
    queryKey: ['cities-all'],
    queryFn: () => citiesAPI.list({ limit: 100 }).then((r) => (r.data?.data || []).map((c) => c.cityName)),
  });

  const customers = custData || [];
  const allAreas = Array.from(
    new Set([...customers.map((c) => c.area).filter(Boolean), ...(managedCitiesData || [])])
  ).sort();

  const filteredCustomers = areaFilter
    ? customers.filter((c) => (c.area || '').toLowerCase() === areaFilter.toLowerCase())
    : customers;

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['customer-ledger', customerId, from, to],
    queryFn: () => ledgerAPI.customer(customerId, { from, to }).then((r) => r.data.data),
    enabled: !!customerId,
  });

  async function exportDoc(fmt) {
    if (!customerId) return;
    try {
      const params = { ...(from && { from }), ...(to && { to }) };
      const res = fmt === 'pdf'
        ? await exportAPI.customerLedgerPDF(customerId, params)
        : await exportAPI.customerLedgerExcel(customerId, params);
      const cust = customers.find((c) => c.id === customerId);
      downloadBlob(res, `CustomerLedger-${cust?.customerName || 'export'}.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch { toast.error('Export failed.'); }
  }

  const transactions = ledger?.transactions || [];
  const summary = ledger?.summary || {};
  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="space-y-4">
      {ledger && <p>Opening balance: <strong>{pkr(ledger.openingBalance)}</strong></p>}
      <PageHeader
        title="Customer Ledger"
        subtitle="Track customer debits, credits, running balance, and statement exports"
        badge={selectedCustomer ? selectedCustomer.customerName : undefined}
        badgeVariant="brand"
        actions={
          customerId && (
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

      {/* Filters Card */}
      <div className="app-filter-bar">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'flex-end', width: '100%' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <MapPin size={12} /> City / Area Filter
            </label>
            <select
              id="cl-area"
              className="form-select text-sm"
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                if (e.target.value) {
                  const cust = customers.find((c) => c.id === customerId);
                  if (cust && (cust.area || '').toLowerCase() !== e.target.value.toLowerCase()) {
                    setCustomerId('');
                  }
                }
              }}
            >
              <option value="">— All Cities / Areas —</option>
              {allAreas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Users size={12} /> Customer *
            </label>
            <select
              id="cl-customer"
              className="form-select text-sm font-medium"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">— Select Customer ({filteredCustomers.length}) —</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerCode ? `[${c.customerCode}] ` : ''}{c.customerName}{c.area ? ` — ${c.area}` : ''}{c.shopName ? ` (${c.shopName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> From Date
            </label>
            <input id="cl-from" type="date" className="form-input text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> To Date
            </label>
            <input id="cl-to" type="date" className="form-input text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      {customerId && summary.closingBalance !== undefined && (
        <KpiGrid cols={3}>
          <KpiCard
            title="Total Debit (Dr)"
            value={pkr(summary.totalDebit)}
            caption="Invoiced sales & charges"
            icon={TrendingUp}
            accentColor="rose"
            badge="DEBIT"
          />
          <KpiCard
            title="Total Credit (Cr)"
            value={pkr(summary.totalCredit)}
            caption="Customer payments received"
            icon={TrendingDown}
            accentColor="emerald"
            badge="CREDIT"
          />
          <KpiCard
            title="Closing Balance"
            value={pkr(summary.closingBalance)}
            caption={parseFloat(summary.closingBalance) > 0 ? 'Receivable from customer' : 'Customer credit balance'}
            icon={Wallet}
            accentColor={parseFloat(summary.closingBalance) > 0 ? 'rose' : 'emerald'}
            badge={parseFloat(summary.closingBalance) > 0 ? 'DR DUE' : 'CR ADV'}
          />
        </KpiGrid>
      )}

      {/* Transactions Table */}
      {customerId ? (
        <div className="app-table-card">
          <div className="flex items-center justify-between p-3 border-b border-border bg-subtle">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Statement Ledger</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt font-medium text-muted">
                {transactions.length} entries
              </span>
            </div>
            {selectedCustomer && (
              <span className="text-xs text-muted font-medium">
                Showing ledger for {selectedCustomer.customerName}
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
                        description="There are no debit or credit transactions recorded for this customer in the selected date range."
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
            title="Select a Customer"
            description="Choose a city/area and customer from the filters above to inspect their real-time ledger statement."
          />
        </div>
      )}
    </div>
  );
}
