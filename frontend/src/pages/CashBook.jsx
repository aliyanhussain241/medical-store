// ─────────────────────────────────────────────────────────────
// src/pages/CashBook.jsx — Client reference format
// DATE | DETAIL (2-line) | RECEIPTS | PAYMENTS | BALANCE
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashBookAPI, exportAPI, downloadBlob, accountHeadsAPI } from '../api/services';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { FileDown, Plus, X, Receipt } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

// Default to current month
const today = new Date();
const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
const defaultTo = today.toISOString().split('T')[0];

export default function CashBook() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const defaultForm = {
    transactionDate: new Date().toISOString().split('T')[0],
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
    <div>
      <div className="page-header">
        <h2 className="page-title">Cash Book</h2>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button
            id="record-expense-btn"
            className="btn btn-sm"
            style={{
              background: '#dc2626',
              color: '#ffffff',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
            onClick={() => {
              setForm({
                transactionDate: new Date().toISOString().split('T')[0],
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
            <Receipt size={14} /> <span className="lbl">+ Record</span> Expense
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => {
            setForm({
              transactionDate: new Date().toISOString().split('T')[0],
              description: '',
              partyName: '',
              cashIn: '',
              cashOut: '',
              category: '',
              accountHeadId: '',
            });
            setModal(true);
          }}><Plus size={13} /> <span className="lbl">Add</span> Entry</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportDoc('pdf')}><FileDown size={13} /> PDF</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportDoc('excel')}><FileDown size={13} /> Excel</button>
        </div>
      </div>

      {/* Date filter */}
      <div className="card card-body" style={{ marginBottom: 14 }}>
        <div className="date-filter-row">
          <div className="form-group">
            <label className="form-label">From</label>
            <input id="cb-from" type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input id="cb-to" type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        <div className="kpi-card">
          <div className="kpi-label">Opening Balance</div>
          <div className="kpi-value tabular">{pkr(openingBalance)}</div>
        </div>
        <div className="kpi-card brand">
          <div className="kpi-label">Total Receipts</div>
          <div className="kpi-value tabular">{pkr(summary.totalIn)}</div>
        </div>
        <div className="kpi-card alert">
          <div className="kpi-label">Total Payments</div>
          <div className="kpi-value tabular">{pkr(summary.totalOut)}</div>
        </div>
        <div className="kpi-card brand">
          <div className="kpi-label">Closing Balance</div>
          <div className={`kpi-value tabular ${closingBalance < 0 ? 'color-alert' : 'color-brand'}`}>{pkr(closingBalance)}</div>
        </div>
      </div>

      {/* Cash Book Table — DATE | DETAIL | RECEIPTS | PAYMENTS | BALANCE */}
      <div className="card">
        <div className="card-header">
          Cash Book Entries
          <span className="text-muted text-sm">{entries.length} entries</span>
        </div>
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Date</th>
                <th>Detail</th>
                <th className="num" style={{ width: 100 }}>Receipts</th>
                <th className="num" style={{ width: 100 }}>Payments</th>
                <th className="num" style={{ width: 110 }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance row */}
              <tr style={{ background: '#F5F5F0', fontWeight: 600 }}>
                <td>{from ? fmtDate(from) : '—'}</td>
                <td style={{ fontStyle: 'italic' }}>Opening Balance</td>
                <td className="num tabular">—</td>
                <td className="num tabular">—</td>
                <td className="num tabular" style={{ fontWeight: 700, color: 'var(--brand)' }}>{pkr(openingBalance)}</td>
              </tr>

              {isLoading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No cash book entries for this period</td></tr>
              ) : entries.map((e) => {
                const cashIn = parseFloat(e.cashIn);
                const cashOut = parseFloat(e.cashOut);
                return (
                  <tr key={e.id}>
                    <td>{fmtDate(e.transactionDate)}</td>
                    <td>
                      {/* Line 1: Description / reference */}
                      <div style={{ fontSize: 12, lineHeight: 1.4 }}>{e.description}</div>
                      {/* Line 2: Sequence + Party Name */}
                      {e.partyName && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#333', marginTop: 1 }}>
                          {e.seq} {e.partyName}
                        </div>
                      )}
                    </td>
                    <td className="num tabular" style={{ color: cashIn > 0 ? 'var(--paid)' : 'var(--text-muted)', fontWeight: cashIn > 0 ? 600 : 400 }}>
                      {cashIn > 0 ? pkr(cashIn) : '—'}
                    </td>
                    <td className="num tabular" style={{ color: cashOut > 0 ? 'var(--alert)' : 'var(--text-muted)', fontWeight: cashOut > 0 ? 600 : 400 }}>
                      {cashOut > 0 ? pkr(cashOut) : '—'}
                    </td>
                    <td className="num tabular" style={{ fontWeight: 600, color: parseFloat(e.runningBalance) < 0 ? 'var(--alert)' : 'var(--brand)' }}>
                      {pkr(e.runningBalance)}
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              {entries.length > 0 && (
                <tr style={{ background: '#222', color: '#fff', fontWeight: 700 }}>
                  <td></td>
                  <td style={{ color: '#fff' }}>TOTAL</td>
                  <td className="num tabular" style={{ color: '#fff' }}>{pkr(summary.totalIn)}</td>
                  <td className="num tabular" style={{ color: '#fff' }}>{pkr(summary.totalOut)}</td>
                  <td className="num tabular" style={{ color: '#fff' }}>{pkr(closingBalance)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 16px' }}>
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
