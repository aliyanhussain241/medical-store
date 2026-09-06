// ─────────────────────────────────────────────────────────────
// src/pages/BankAccounts.jsx — Full CRUD for bank accounts
// Mirrors Companies.jsx pattern
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankAccountsAPI } from '../api/services';
import useDebounce from '../utils/useDebounce';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, X, Landmark } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
const EMPTY = { bankName: '', accountTitle: '', accountNumber: '', branch: '', openingBalance: '' };
const PAGE_SIZE = 25;

export default function BankAccounts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['bank-accounts', debouncedSearch, page],
    queryFn: () => bankAccountsAPI.list({ search: debouncedSearch, limit: PAGE_SIZE, page }).then((r) => r.data),
  });

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const saveMutation = useMutation({
    mutationFn: (d) => editId ? bankAccountsAPI.update(editId, d) : bankAccountsAPI.create(d),
    onSuccess: () => { qc.invalidateQueries(['bank-accounts']); toast.success(editId ? 'Bank account updated.' : 'Bank account added.'); closeModal(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Error saving bank account.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => bankAccountsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['bank-accounts']); toast.success('Bank account deleted.'); setDelId(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot delete bank account.'),
  });

  function openAdd() { setForm(EMPTY); setEditId(null); setModal('add'); }
  function openEdit(a) {
    setForm({
      bankName: a.bankName, accountTitle: a.accountTitle,
      accountNumber: a.accountNumber, branch: a.branch || '',
      openingBalance: a.openingBalance,
    });
    setEditId(a.id); setModal('edit');
  }
  function closeModal() { setModal(null); setEditId(null); }
  function set(f) { return (e) => setForm({ ...form, [f]: e.target.value }); }

  useEffect(() => {
    if (modal) {
      setTimeout(() => document.getElementById('bank-name')?.focus(), 80);
    }
  }, [modal]);

  const accounts = data?.data || [];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Bank Accounts</h2>
        <button id="add-bank-btn" className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Bank Account</button>
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input id="bank-search" placeholder="Search by bank name, account title, account number..." value={search} onChange={handleSearch} />
        </div>
        <span className="text-muted">{data?.total || 0} accounts</span>
      </div>

      <div className="card">
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bank Name</th>
                <th>Account Title</th>
                <th>Account Number</th>
                <th>Branch</th>
                <th className="num">Opening Balance</th>
                <th className="num">Current Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No bank accounts found</td></tr>
              ) : accounts.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Landmark size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      {a.bankName}
                    </div>
                  </td>
                  <td>{a.accountTitle}</td>
                  <td className="tabular" style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.accountNumber}</td>
                  <td className="text-muted text-sm">{a.branch || '—'}</td>
                  <td className="num tabular">{pkr(a.openingBalance)}</td>
                  <td className="num tabular" style={{ color: parseFloat(a.currentBalance) >= 0 ? 'var(--paid)' : 'var(--alert)', fontWeight: 600 }}>
                    {pkr(a.currentBalance)}
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn-icon" onClick={() => openEdit(a)}><Pencil size={13} /></button>
                      <button className="btn-icon" onClick={() => setDelId(a.id)} style={{ color: 'var(--alert)' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 16px' }}>
          <Pagination page={page} total={data?.total || 0} limit={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleFormEnterKey(e, () => { if (form.bankName && form.accountNumber) saveMutation.mutate(form); })}
          >
            <div className="modal-header">
              <span>{modal === 'add' ? 'Add Bank Account' : 'Edit Bank Account'}</span>
              <button className="btn-icon" onClick={closeModal}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Bank Name *</label>
                  <input id="bank-name" className="form-input" value={form.bankName} onChange={set('bankName')} placeholder="e.g. HBL, Meezan Bank" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Title *</label>
                  <input id="bank-title" className="form-input" value={form.accountTitle} onChange={set('accountTitle')} placeholder="Account holder name" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Account Number *</label>
                  <input id="bank-number" className="form-input" value={form.accountNumber} onChange={set('accountNumber')} placeholder="e.g. 1234-5678901234" />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input id="bank-branch" className="form-input" value={form.branch} onChange={set('branch')} placeholder="Optional" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Opening Balance (Rs)</label>
                <input id="bank-ob" type="number" step="0.01" className="form-input" value={form.openingBalance} onChange={set('openingBalance')} disabled={!!editId} />
                {editId && <span className="form-hint">Opening balance cannot be changed after creation.</span>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button id="save-bank-btn" className="btn btn-primary" disabled={saveMutation.isPending || !form.bankName || !form.accountTitle || !form.accountNumber}
                onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : modal === 'add' ? 'Save Bank Account' : 'Update Bank Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {delId && (
        <div className="modal-overlay" onClick={() => setDelId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Confirm Delete</div>
            <div className="modal-body"><p style={{ fontSize: 13 }}>Delete this bank account? This cannot be undone.</p></div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDelId(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(delId)}>
                {deleteMutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
