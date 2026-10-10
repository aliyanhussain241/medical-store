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
import { Plus, Search, Pencil, Trash2, X, Landmark, Wallet, CheckCircle2 } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

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
  const totalBalance = accounts.reduce((sum, a) => sum + (parseFloat(a.currentBalance) || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bank Accounts"
        subtitle="Manage company bank accounts, deposit channels, account numbers, and current balances"
        actions={
          <button id="add-bank-btn" className="btn btn-primary" onClick={openAdd}>
            <Plus size={14} /> Add Bank Account
          </button>
        }
      />

      {/* KPI Cards */}
      <KpiGrid cols={3}>
        <KpiCard
          title="Bank Accounts"
          value={data?.total ?? accounts.length}
          caption="Active checking & saving accounts"
          icon={Landmark}
          accentColor="brand"
          badge="REGISTERED"
        />
        <KpiCard
          title="Total Bank Liquidity"
          value={pkr(totalBalance)}
          caption="Aggregate current bank balances"
          icon={Wallet}
          accentColor={totalBalance >= 0 ? 'emerald' : 'rose'}
          badge={totalBalance >= 0 ? 'LIQUID' : 'OVERDRAWN'}
        />
        <KpiCard
          title="Banking Status"
          value="Operational"
          caption="All linked channels active"
          icon={CheckCircle2}
          accentColor="blue"
          badge="HEALTHY"
        />
      </KpiGrid>

      {/* Search / Filter Bar */}
      <div className="app-filter-bar">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
          <div className="search-input-wrap" style={{ flex: '1 1 280px', minWidth: 240 }}>
            <Search size={14} />
            <input
              id="bank-search"
              type="text"
              className="form-input text-sm"
              placeholder="Search by bank name, account title, account number..."
              value={search}
              onChange={handleSearch}
            />
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-muted ml-auto">
            {data?.total || accounts.length} accounts found
          </span>
        </div>
      </div>

      {/* Table Card */}
      <div className="app-table-card">
        <div className="flex items-center justify-between p-3 border-b border-border bg-subtle">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Configured Bank Accounts</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt font-medium text-muted">
              {accounts.length} showing
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bank Name</th>
                <th>Account Title</th>
                <th>Account Number</th>
                <th>Branch</th>
                <th className="num" style={{ width: 140 }}>Opening Balance</th>
                <th className="num" style={{ width: 140 }}>Current Balance</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={7} rows={4} />
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <EmptyState
                      icon={Landmark}
                      title="No bank accounts found"
                      description="Add your first company bank account to start recording transactions and deposits."
                      actionLabel="+ Add Bank Account"
                      onAction={openAdd}
                    />
                  </td>
                </tr>
              ) : (
                accounts.map((a) => {
                  const currBal = parseFloat(a.currentBalance) || 0;
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Landmark size={14} style={{ color: 'var(--brand)' }} />
                          </div>
                          <span>{a.bankName}</span>
                        </div>
                      </td>
                      <td className="text-sm font-medium">{a.accountTitle}</td>
                      <td className="tabular text-xs font-mono font-medium">{a.accountNumber}</td>
                      <td className="text-muted text-xs">{a.branch || '—'}</td>
                      <td className="num tabular font-medium text-muted">{pkr(a.openingBalance)}</td>
                      <td className="num tabular font-bold" style={{ color: currBal >= 0 ? 'var(--paid)' : 'var(--alert)' }}>
                        {pkr(currBal)}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn-icon" onClick={() => openEdit(a)} title="Edit Account">
                            <Pencil size={13} />
                          </button>
                          <button className="btn-icon" onClick={() => setDelId(a.id)} style={{ color: 'var(--alert)' }} title="Delete Account">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-border">
          <Pagination page={page} total={data?.total || 0} limit={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleFormEnterKey(e, () => { if (form.bankName && form.accountNumber) saveMutation.mutate(form); })}
          >
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Landmark size={16} className="text-brand" />
                <span className="font-semibold text-base">{modal === 'add' ? 'Add Bank Account' : 'Edit Bank Account'}</span>
              </div>
              <button className="btn-icon" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="modal-body space-y-3">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Bank Name *</label>
                  <input id="bank-name" className="form-input text-sm" value={form.bankName} onChange={set('bankName')} placeholder="e.g. HBL, Meezan Bank" required />
                </div>
                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Account Title *</label>
                  <input id="bank-title" className="form-input text-sm" value={form.accountTitle} onChange={set('accountTitle')} placeholder="Account holder name" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Account Number *</label>
                  <input id="bank-number" className="form-input text-sm font-mono" value={form.accountNumber} onChange={set('accountNumber')} placeholder="e.g. 1234-5678901234" />
                </div>
                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Branch</label>
                  <input id="bank-branch" className="form-input text-sm" value={form.branch} onChange={set('branch')} placeholder="Branch name / code" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Opening Balance (Rs)</label>
                <input id="bank-ob" type="number" step="0.01" className="form-input text-sm tabular font-semibold" value={form.openingBalance} onChange={set('openingBalance')} disabled={!!editId} />
                {editId && <span className="form-hint text-xs text-muted mt-1 block">Opening balance cannot be changed after creation.</span>}
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
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="font-semibold text-base">Confirm Delete</span>
              <button className="btn-icon" onClick={() => setDelId(null)}><X size={15} /></button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted">Are you sure you want to delete this bank account? This cannot be undone.</p>
            </div>
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
