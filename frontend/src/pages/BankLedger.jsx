import { businessDay } from '../utils/businessDate';
// ─────────────────────────────────────────────────────────────
// src/pages/BankLedger.jsx — Bank account transaction history
// Mirrors CompanyLedger.jsx pattern + manual entry support
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankAccountsAPI, ledgerAPI, bankBookAPI, exportAPI, downloadBlob } from '../api/services';
import toast from 'react-hot-toast';
import { Plus, X, Landmark, FileDown, ArrowDownLeft, ArrowUpRight, Wallet, BookOpen, Calendar } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-PK') : '—'; }

export default function BankLedger() {
  const qc = useQueryClient();
  const [bankAccountId, setBankAccountId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [manualModal, setManualModal] = useState(false);

  const { data: bankData } = useQuery({
    queryKey: ['bank-accounts-all'],
    queryFn: () => bankAccountsAPI.list({ limit: 500 }).then((r) => r.data.data),
  });

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['bank-ledger', bankAccountId, from, to],
    queryFn: () => ledgerAPI.bank(bankAccountId, { from, to }).then((r) => r.data.data),
    enabled: !!bankAccountId,
  });

  async function exportDoc(fmt) {
    if (!bankAccountId) return;
    try {
      const params = { ...(from && { from }), ...(to && { to }) };
      const res = fmt === 'pdf'
        ? await exportAPI.bankLedgerPDF(bankAccountId, params)
        : await exportAPI.bankLedgerExcel(bankAccountId, params);
      const bank = bankData?.find((a) => a.id === bankAccountId);
      downloadBlob(res, `BankLedger-${bank?.bankName || 'bank'}.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast.success(`${fmt.toUpperCase()} downloaded.`);
    } catch { toast.error('Export failed.'); }
  }

  const accounts = bankData || [];
  const transactions = ledger?.transactions || [];
  const summary = ledger?.summary || {};
  const selectedBank = accounts.find((a) => a.id === bankAccountId);

  return (
    <div className="space-y-4">
      {ledger && <p>Opening balance: <strong>{pkr(ledger.openingBalance)}</strong></p>}
      <PageHeader
        title="Bank Ledger"
        subtitle="Track bank deposits, withdrawals, cheques, and running statement balances"
        badge={selectedBank ? `${selectedBank.bankName} - ${selectedBank.accountTitle}` : undefined}
        badgeVariant="brand"
        actions={
          bankAccountId && (
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-outline btn-sm" onClick={() => exportDoc('pdf')} title="Export PDF">
                <FileDown size={14} /> PDF
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => exportDoc('excel')} title="Export Excel">
                <FileDown size={14} /> Excel
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setManualModal(true)}>
                <Plus size={14} /> Manual Entry
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
              <Landmark size={12} /> Bank Account *
            </label>
            <select
              id="bl-bank"
              className="form-select text-sm font-medium"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
            >
              <option value="">— Select Bank Account ({accounts.length}) —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.bankName} — {a.accountTitle} ({a.accountNumber})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> From Date
            </label>
            <input id="bl-from" type="date" className="form-input text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Calendar size={12} /> To Date
            </label>
            <input id="bl-to" type="date" className="form-input text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      {bankAccountId && summary.closingBalance !== undefined && (
        <KpiGrid cols={3}>
          <KpiCard
            title="Total Deposits (Dr)"
            value={pkr(summary.totalDebit)}
            caption="Inflows and customer cheques"
            icon={ArrowDownLeft}
            accentColor="emerald"
            badge="INFLOW"
          />
          <KpiCard
            title="Total Withdrawals (Cr)"
            value={pkr(summary.totalCredit)}
            caption="Outflows and supplier payments"
            icon={ArrowUpRight}
            accentColor="rose"
            badge="OUTFLOW"
          />
          <KpiCard
            title="Closing Balance"
            value={pkr(summary.closingBalance)}
            caption={parseFloat(summary.closingBalance) >= 0 ? 'Positive bank balance' : 'Overdraft balance'}
            icon={Wallet}
            accentColor={parseFloat(summary.closingBalance) >= 0 ? 'emerald' : 'rose'}
            badge={parseFloat(summary.closingBalance) >= 0 ? 'NET CR' : 'OVERDRAFT'}
          />
        </KpiGrid>
      )}

      {/* Transactions Table */}
      {bankAccountId ? (
        <div className="app-table-card">
          <div className="flex items-center justify-between p-3 border-b border-border bg-subtle">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Statement Ledger</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt font-medium text-muted">
                {transactions.length} entries
              </span>
            </div>
            {selectedBank && (
              <span className="text-xs text-muted font-medium">
                {selectedBank.bankName} · {selectedBank.accountNumber}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Date</th>
                  <th>Description</th>
                  <th>Narration</th>
                  <th style={{ width: 100 }}>Ref Type</th>
                  <th className="num" style={{ width: 130 }}>Debit (Dr)</th>
                  <th className="num" style={{ width: 130 }}>Credit (Cr)</th>
                  <th className="num" style={{ width: 140 }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton cols={7} rows={6} />
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <EmptyState
                        icon={BookOpen}
                        title="No transactions found"
                        description="There are no deposit or withdrawal transactions recorded for this account in the selected date range."
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
                        <td className="text-muted text-xs">{t.narration || '—'}</td>
                        <td>
                          <span className="badge badge-brand text-xs font-semibold tracking-wider">
                            {t.referenceType}
                          </span>
                        </td>
                        <td className="num tabular font-semibold" style={{ color: dr > 0 ? 'var(--paid)' : 'var(--text-muted)' }}>
                          {dr > 0 ? pkr(dr) : '—'}
                        </td>
                        <td className="num tabular font-semibold" style={{ color: cr > 0 ? 'var(--alert)' : 'var(--text-muted)' }}>
                          {cr > 0 ? pkr(cr) : '—'}
                        </td>
                        <td className="num tabular font-bold" style={{ color: bal >= 0 ? 'var(--brand)' : 'var(--alert)' }}>
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
            icon={Landmark}
            title="Select a Bank Account"
            description="Choose a bank account from the dropdown above to inspect deposit, withdrawal, and transfer statements."
          />
        </div>
      )}

      {manualModal && (
        <ManualEntryModal
          bankAccountId={bankAccountId}
          bankName={selectedBank?.bankName || ''}
          onClose={() => setManualModal(false)}
          onSuccess={() => {
            qc.invalidateQueries(['bank-ledger']);
            qc.invalidateQueries(['bank-accounts']);
            setManualModal(false);
          }}
        />
      )}
    </div>
  );
}

function ManualEntryModal({ bankAccountId, bankName, onClose, onSuccess }) {
  const [type, setType] = useState('DEPOSIT'); // DEPOSIT | WITHDRAWAL
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [narration, setNarration] = useState('');
  const [partyName, setPartyName] = useState('');
  const [transactionDate, setTransactionDate] = useState(businessDay());

  const mutation = useMutation({
    mutationFn: (data) => bankBookAPI.create(data),
    onSuccess: () => {
      toast.success('Bank entry added.');
      onSuccess();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error adding entry.'),
  });

  function handleSave() {
    if (!amount || parseFloat(amount) <= 0) { toast.error('Amount must be greater than 0.'); return; }
    if (!description.trim()) { toast.error('Description is required.'); return; }

    mutation.mutate({
      bankAccountId,
      description: description.trim(),
      debit: type === 'DEPOSIT' ? parseFloat(amount) : 0,
      credit: type === 'WITHDRAWAL' ? parseFloat(amount) : 0,
      transactionDate,
      narration: narration.trim() || undefined,
      partyName: partyName.trim() || undefined,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => handleFormEnterKey(e, handleSave)}
      >
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Landmark size={16} className="text-brand" />
            <span className="font-semibold text-base">Manual Bank Entry — {bankName}</span>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body space-y-3">
          <div className="form-group">
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Entry Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${type === 'DEPOSIT' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setType('DEPOSIT')}
                style={{ flex: 1 }}
              >
                ↓ Deposit (Debit Inflow)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${type === 'WITHDRAWAL' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setType('WITHDRAWAL')}
                style={{ flex: 1 }}
              >
                ↑ Withdrawal (Credit Outflow)
              </button>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Amount (Rs) *</label>
              <input type="number" step="0.01" min="0" className="form-input tabular" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus style={{ fontSize: 16, fontWeight: 700 }} />
            </div>
            <div className="form-group">
              <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Date</label>
              <input type="date" className="form-input text-sm" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Description *</label>
            <input className="form-input text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Owner deposit, Transfer from cash" />
          </div>
          <div className="form-group">
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Party Name</label>
            <input className="form-input text-sm" value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Optional party name" />
          </div>
          <div className="form-group">
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Narration</label>
            <textarea className="form-input text-sm" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Optional note / cheque details..." rows={2} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={mutation.isPending || !amount || !description.trim()} onClick={handleSave}>
            {mutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
