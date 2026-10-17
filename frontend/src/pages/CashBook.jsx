import { businessDay, businessMonthStart } from '../utils/businessDate';
// ─────────────────────────────────────────────────────────────
// src/pages/CashBook.jsx — Client reference format
// DATE | DETAIL (2-line) | RECEIPTS | PAYMENTS | BALANCE
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashBookAPI, exportAPI, downloadBlob, accountHeadsAPI } from '../api/services';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { FileDown, Plus, X, Receipt, ArrowDownLeft, ArrowUpRight, Wallet, Calendar } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

// Default to current month
const today = new Date();
const defaultFrom = businessMonthStart();
const defaultTo = businessDay(today);

export default function CashBook() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const defaultForm = {
    transactionDate: businessDay(),
    description: '',
    cashIn: '',
    cashOut: '',
    partyName: '',
    category: '', // '', 'EXPENSE'
    accountHeadId: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const { data: headsData } = useQuery({
    queryKey: ['account-heads-all'],
    queryFn: () => accountHeadsAPI.list().then((r) => r.data?.data || []),
  });
  const accountHeads = headsData || [];

  const { data, isLoading } = useQuery({
    queryKey: ['cash-book', from, to, page],
    queryFn: () => cashBookAPI.list({ from, to, limit: PAGE_SIZE, page }).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (d) => cashBookAPI.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['cash-book']);
      toast.success('Entry added.');
      setModal(false);
      setForm({ ...defaultForm });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error adding entry.'),
  });

  async function exportDoc(fmt) {
    try {
      const params = { ...(from && { from }), ...(to && { to }) };
      const res = fmt === 'pdf' ? await exportAPI.cashBookPDF(params) : await exportAPI.cashBookExcel(params);
      downloadBlob(res, `CashBook.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch { toast.error('Export failed.'); }
  }

  const entries = data?.data || [];
  const summary = data?.summary || {};
  const openingBalance = parseFloat(data?.openingBalance || 0);
  const closingBalance = openingBalance + parseFloat(summary.totalIn || 0) - parseFloat(summary.totalOut || 0);

  function set(f) { return (e) => setForm({ ...form, [f]: e.target.value }); }

  useEffect(() => {
    if (modal) {
      setTimeout(() => document.getElementById('cb-entry-type')?.focus(), 80);
    }
  }, [modal]);

  // Entry type display
  const entryTypeLabel = form.category === 'EXPENSE' ? 'Cash Expense' : (parseFloat(form.cashIn) > 0 ? 'Receipt (MCR)' : (parseFloat(form.cashOut) > 0 ? 'Payment (MCP)' : '—'));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cash Book"
        subtitle="Daily cash journal recording receipts, expenses, vendor payments, and closing cash in hand"
        badge="DAILY REGISTER"
        badgeVariant="brand"
        actions={
          <div className="flex gap-2 flex-wrap">
            <button
              id="record-expense-btn"
              className="btn btn-sm"
              style={{
                background: '#dc2626',
                color: '#ffffff',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)',
              }}
              onClick={() => {
                setForm({
                  transactionDate: businessDay(),
                  description: '',
                  partyName: '',
                  cashIn: '',
                  cashOut: '',
                  category: 'EXPENSE',
                  accountHeadId: accountHeads.find((h) => h.category === 'EXPENSE')?.id || '',
                });
                setModal(true);
              }}
            >
              <Receipt size={14} /> + Record Expense
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setForm({
                  transactionDate: businessDay(),
                  description: '',
                  partyName: '',
                  cashIn: '',
                  cashOut: '',
                  category: '',
                  accountHeadId: '',
                });
                setModal(true);
              }}
            >
              <Plus size={14} /> Add Entry
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => exportDoc('pdf')} title="Export PDF">
              <FileDown size={14} /> PDF
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => exportDoc('excel')} title="Export Excel">
              <FileDown size={14} /> Excel
            </button>
          </div>
        }
      />

      {/* Date filter bar */}
      <div className="app-filter-bar">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'flex-end', width: '100%' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> From Date
            </label>
            <input id="cb-from" type="date" className="form-input text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> To Date
            </label>
            <input id="cb-to" type="date" className="form-input text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <KpiGrid cols={4}>
        <KpiCard
          title="Opening Balance"
          value={pkr(openingBalance)}
          caption={`As of ${from ? fmtDate(from) : 'start'}`}
          icon={Wallet}
          accentColor="slate"
          badge="START"
        />
        <KpiCard
          title="Total Receipts"
          value={pkr(summary.totalIn)}
          caption="Cash collections & inflows"
          icon={ArrowDownLeft}
          accentColor="emerald"
          badge="RECEIPTS"
        />
        <KpiCard
          title="Total Payments"
          value={pkr(summary.totalOut)}
          caption="Disbursements & expenses"
          icon={ArrowUpRight}
          accentColor="rose"
          badge="PAYMENTS"
        />
        <KpiCard
          title="Closing Balance"
          value={pkr(closingBalance)}
          caption={closingBalance >= 0 ? 'Cash in hand available' : 'Negative cash balance'}
          icon={Wallet}
          accentColor={closingBalance >= 0 ? 'emerald' : 'rose'}
          badge={closingBalance >= 0 ? 'NET CASH' : 'DEFICIT'}
        />
      </KpiGrid>

      {/* Cash Book Table — DATE | DETAIL | RECEIPTS | PAYMENTS | BALANCE */}
      <div className="app-table-card">
        <div className="flex items-center justify-between p-3 border-b border-border bg-subtle">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Cash Journal Entries</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt font-medium text-muted">
              {data?.total || entries.length} entries
            </span>
          </div>
          <span className="text-xs text-muted font-medium">
            Page {page} of {Math.ceil((data?.total || 1) / PAGE_SIZE)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Date</th>
                <th>Detail</th>
                <th className="num" style={{ width: 130 }}>Receipts</th>
                <th className="num" style={{ width: 130 }}>Payments</th>
                <th className="num" style={{ width: 140 }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance row */}
              <tr style={{ background: 'var(--subtle, #f8fafc)', fontWeight: 600 }}>
                <td className="text-sm font-medium">{from ? fmtDate(from) : '—'}</td>
                <td style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Opening Balance Brought Forward</td>
                <td className="num tabular text-muted">—</td>
                <td className="num tabular text-muted">—</td>
                <td className="num tabular font-bold" style={{ color: 'var(--brand)' }}>{pkr(openingBalance)}</td>
              </tr>

              {isLoading ? (
                <TableSkeleton cols={5} rows={6} />
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={Wallet}
                      title="No cash book entries"
                      description="No receipts or cash payment transactions found for this date range."
                    />
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const cashIn = parseFloat(e.cashIn) || 0;
                  const cashOut = parseFloat(e.cashOut) || 0;
                  const bal = parseFloat(e.runningBalance) || 0;
                  return (
                    <tr key={e.id}>
                      <td className="text-sm font-medium">{fmtDate(e.transactionDate)}</td>
                      <td>
                        <div className="text-sm font-medium text-text">{e.description}</div>
                        {e.partyName && (
                          <div className="text-xs font-semibold text-muted mt-0.5">
                            {e.seq ? `${e.seq} ` : ''}{e.partyName}
                          </div>
                        )}
                      </td>
                      <td className="num tabular font-semibold" style={{ color: cashIn > 0 ? 'var(--paid)' : 'var(--text-muted)' }}>
                        {cashIn > 0 ? pkr(cashIn) : '—'}
                      </td>
                      <td className="num tabular font-semibold" style={{ color: cashOut > 0 ? 'var(--alert)' : 'var(--text-muted)' }}>
                        {cashOut > 0 ? pkr(cashOut) : '—'}
                      </td>
                      <td className="num tabular font-bold" style={{ color: bal < 0 ? 'var(--alert)' : 'var(--brand)' }}>
                        {pkr(bal)}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Totals row */}
              {entries.length > 0 && (
                <tr style={{ background: '#1e293b', color: '#fff', fontWeight: 700 }}>
                  <td></td>
                  <td style={{ color: '#fff' }}>TOTAL FOR PERIOD</td>
                  <td className="num tabular" style={{ color: '#34d399' }}>{pkr(summary.totalIn)}</td>
                  <td className="num tabular" style={{ color: '#f87171' }}>{pkr(summary.totalOut)}</td>
                  <td className="num tabular" style={{ color: '#fff' }}>{pkr(closingBalance)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-border">
          <Pagination page={page} total={data?.total || 0} limit={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {/* ──── Add Entry Modal ──── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleFormEnterKey(e, () => { if (form.description) saveMutation.mutate(form); })}
          >
            <div className="modal-header">
              <span>{form.category === 'EXPENSE' ? '💸 Record Cash Expense' : 'Add Cash Book Entry'}</span>
              <button className="btn-icon" onClick={() => setModal(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              {/* Entry Type */}
              <div className="form-group">
                <label className="form-label">Entry Type</label>
                <select id="cb-entry-type" className="form-select" value={form.category} onChange={set('category')}>
                  <option value="">Receipt / Payment</option>
                  <option value="EXPENSE">Cash Expense (misc)</option>
                </select>
              </div>

              {/* Account Head (Chart of Accounts) */}
              <div className="form-group">
                <label className="form-label">Account Head (Chart of Accounts)</label>
                <select
                  className="form-select"
                  value={form.accountHeadId}
                  onChange={(e) => {
                    const headId = e.target.value;
                    const head = accountHeads.find((h) => h.id === headId);
                    setForm({
                      ...form,
                      accountHeadId: headId,
                      ...(head && head.category === 'EXPENSE' ? { category: 'EXPENSE' } : {}),
                    });
                  }}
                >
                  <option value="">-- None / General --</option>
                  {accountHeads.map((h) => (
                    <option key={h.id} value={h.id}>
                      [{h.category}] {h.name}
                    </option>
                  ))}
                </select>
                <span className="text-muted text-xs" style={{ marginTop: 2, display: 'block' }}>
                  Tag this transaction to an Expense, Income, or Liability account head.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input id="cb-entry-date" type="date" className="form-input" value={form.transactionDate} onChange={set('transactionDate')} />
              </div>

              <div className="form-group">
                <label className="form-label">Description *</label>
                <input id="cb-desc" className="form-input"
                  placeholder={form.category === 'EXPENSE' ? 'e.g. Lunch, Petrol, Chai, Transport...' : 'e.g. Received Cash, Paid Cash...'}
                  value={form.description} onChange={set('description')} required />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {form.category === 'EXPENSE' ? 'Expense Category / Person' : 'Party Name (Customer / Company / Counter)'}
                </label>
                <input id="cb-party" className="form-input"
                  placeholder={form.category === 'EXPENSE' ? 'e.g. REFRESHMENT, TRANSPORT' : 'e.g. DANISH RAJPOOT, AZAM MEDICAL STORE'}
                  value={form.partyName} onChange={set('partyName')} />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--paid)' }}>
                    {form.category === 'EXPENSE' ? '—' : '💰 Receipt Amount (Rs)'}
                  </label>
                  {form.category !== 'EXPENSE' && (
                    <input id="cb-in" type="number" step="0.01" min="0" className="form-input" placeholder="0.00" value={form.cashIn} onChange={set('cashIn')} />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--alert)' }}>
                    {form.category === 'EXPENSE' ? '💸 Expense Amount (Rs)' : '💸 Payment Amount (Rs)'}
                  </label>
                  <input id="cb-out" type="number" step="0.01" min="0" className="form-input" placeholder="0.00" value={form.cashOut} onChange={set('cashOut')} />
                </div>
              </div>

              {/* Auto-assign preview */}
              <div style={{ background: '#F5F5F0', borderRadius: 4, padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Type: <strong>{entryTypeLabel}</strong> — Reference number will be auto-assigned (MCR# or MCP#)
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
              <button id="save-cb-btn" className="btn btn-primary" disabled={saveMutation.isPending || !form.description}
                onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
