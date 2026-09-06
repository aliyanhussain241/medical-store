// ─────────────────────────────────────────────────────────────
// src/pages/CustomerLedger.jsx
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersAPI, ledgerAPI, invoicesAPI, exportAPI, downloadBlob, citiesAPI } from '../api/services';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileDown, DollarSign, X } from 'lucide-react';
import { invoicesAPI as inv } from '../api/services';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-PK') : '—'; }

export default function CustomerLedger() {
  const qc = useQueryClient();
  const [areaFilter, setAreaFilter] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');

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

  const payMutation = useMutation({
    mutationFn: ({ amount }) => inv.recordPayment
      ? Promise.reject('use invoice payment') // payments handled via invoice payment
      : Promise.resolve(),
    onError: () => {},
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
    <div>
      <div className="page-header">
        <h2 className="page-title">Customer Ledger</h2>
        {customerId && (
          <div className="flex gap-8">
            <button className="btn btn-outline btn-sm" onClick={() => exportDoc('pdf')}><FileDown size={13} /> PDF</button>
            <button className="btn btn-outline btn-sm" onClick={() => exportDoc('excel')}><FileDown size={13} /> Excel</button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card card-body mb-12" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">City / Area Filter</label>
            <select
              id="cl-area"
              className="form-select"
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                // If current customer doesn't belong to newly selected area, reset
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
            <label className="form-label">Customer *</label>
            <select id="cl-customer" className="form-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— Select Customer ({filteredCustomers.length}) —</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerCode ? `[${c.customerCode}] ` : ''}{c.customerName}{c.area ? ` — ${c.area}` : ''}{c.shopName ? ` (${c.shopName})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input id="cl-from" type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input id="cl-to" type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      {customerId && summary.closingBalance !== undefined && (
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
          {selectedCustomer && (
            <div className="kpi-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="kpi-label">{selectedCustomer.customerName}</div>
                <div className="text-muted text-sm">{selectedCustomer.phone || '—'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transactions Table */}
      {customerId && (
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
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No transactions found for this customer</td></tr>
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
      )}

      {!customerId && (
        <div className="empty-state">
          <p>Select a customer above to view their ledger</p>
        </div>
      )}
    </div>
  );
}
