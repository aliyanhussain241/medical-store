// ─────────────────────────────────────────────────────────────
// src/pages/BankLedger.jsx — Bank account transaction history
// Mirrors CompanyLedger.jsx pattern + manual entry support
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankAccountsAPI, ledgerAPI, bankBookAPI, exportAPI, downloadBlob } from '../api/services';
import toast from 'react-hot-toast';
import { Plus, X, Landmark, FileDown } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';

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
    <div>
      <div className="page-header">
        <h2 className="page-title">Bank Ledger</h2>
        <div className="flex gap-8">
          {bankAccountId && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => exportDoc('pdf')}>
                <FileDown size={13} /> Export PDF
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => exportDoc('excel')}>
                <FileDown size={13} /> Export Excel
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setManualModal(true)}>
                <Plus size={13} /> Manual Entry
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card card-body" style={{ marginBottom: 14 }}>
        <div className="grid-3" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Bank Account *</label>
            <select id="bl-bank" className="form-select" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
              <option value="">— Select Bank Account —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountTitle} ({a.accountNumber})</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input id="bl-from" type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input id="bl-to" type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {bankAccountId && summary.closingBalance !== undefined && (
        <div className="kpi-grid" style={{ marginBottom: 14 }}>
          <div className="kpi-card">
            <div className="kpi-label">Total Debit (Dr)</div>
            <div className="kpi-value color-brand tabular">{pkr(summary.totalDebit)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Credit (Cr)</div>
            <div className="kpi-value color-alert tabular">{pkr(summary.totalCredit)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Closing Balance</div>
            <div className={`kpi-value tabular ${parseFloat(summary.closingBalance) >= 0 ? 'color-brand' : 'color-alert'}`}>
              {pkr(summary.closingBalance)}
            </div>
          </div>
          {selectedBank && (
            <div className="kpi-card">
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Landmark size={13} style={{ color: 'var(--accent)' }} />
                {selectedBank.bankName}
              </div>
              <div className="text-muted text-sm">{selectedBank.accountTitle}</div>
              <div className="text-muted text-sm" style={{ fontFamily: 'monospace' }}>{selectedBank.accountNumber}</div>
            </div>
          )}
        </div>
      )}

      {bankAccountId ? (
        <div className="card">
          <div className="card-header">
            <span>Bank Transactions</span>
            <span className="text-muted text-sm">{transactions.length} entries</span>
          </div>
          <div className="data-table-wrap" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Narration</th>
                  <th>Ref Type</th>
                  <th className="num">Debit (Dr)</th>
                  <th className="num">Credit (Cr)</th>
                  <th className="num">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No transactions found</td></tr>
                ) : transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.transactionDate)}</td>
                    <td>{t.description}</td>
                    <td className="text-muted text-sm">{t.narration || '—'}</td>
                    <td><span className="badge badge-brand" style={{ fontSize: 10 }}>{t.referenceType}</span></td>
                    <td className="num tabular" style={{ color: parseFloat(t.debit) > 0 ? 'var(--paid)' : 'var(--text-muted)' }}>
                      {parseFloat(t.debit) > 0 ? pkr(t.debit) : '—'}
                    </td>
                    <td className="num tabular" style={{ color: parseFloat(t.credit) > 0 ? 'var(--alert)' : 'var(--text-muted)' }}>
                      {parseFloat(t.credit) > 0 ? pkr(t.credit) : '—'}
                    </td>
                    <td className="num tabular" style={{ fontWeight: 600, color: parseFloat(t.runningBalance) >= 0 ? 'var(--brand)' : 'var(--alert)' }}>
                      {pkr(t.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state"><p>Select a bank account above to view its ledger</p></div>
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
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

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
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => handleFormEnterKey(e, handleSave)}
      >
        <div className="modal-header">
          <span>Manual Bank Entry — {bankName}</span>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Entry Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-sm ${type === 'DEPOSIT' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setType('DEPOSIT')}
                style={{ flex: 1 }}
              >
                ↓ Deposit (Debit)
              </button>
              <button
                className={`btn btn-sm ${type === 'WITHDRAWAL' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setType('WITHDRAWAL')}
                style={{ flex: 1 }}
              >
                ↑ Withdrawal (Credit)
              </button>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Amount (Rs) *</label>
              <input type="number" step="0.01" min="0" className="form-input tabular" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus style={{ fontSize: 16, fontWeight: 700 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description *</label>
            <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Owner deposit, Transfer from cash" />
          </div>
          <div className="form-group">
            <label className="form-label">Party Name</label>
            <input className="form-input" value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label className="form-label">Narration</label>
            <textarea className="form-input" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Optional note..." rows={2} style={{ resize: 'vertical' }} />
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
