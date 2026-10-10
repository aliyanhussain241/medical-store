// ─────────────────────────────────────────────────────────────
// src/pages/ChartOfAccounts.jsx — Chart of Accounts Management
// Categories: Expense, Income, Liability
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountHeadsAPI } from '../api/services';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, X, Layers, TrendingUp, TrendingDown, ShieldAlert } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

const CATEGORIES = [
  { value: 'EXPENSE', label: 'Expense', icon: TrendingDown, color: '#EF4444', accent: 'rose' },
  { value: 'INCOME', label: 'Income', icon: TrendingUp, color: '#10B981', accent: 'emerald' },
  { value: 'LIABILITY', label: 'Liability', icon: ShieldAlert, color: '#8B5CF6', accent: 'blue' },
];

const EMPTY = { name: '', category: 'EXPENSE', description: '' };

export default function ChartOfAccounts() {
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['account-heads'],
    queryFn: () => accountHeadsAPI.list().then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (d) => editId ? accountHeadsAPI.update(editId, d) : accountHeadsAPI.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['account-heads']);
      toast.success(editId ? 'Account head updated.' : 'Account head created.');
      closeModal();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error saving account head.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => accountHeadsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['account-heads']);
      toast.success('Account head deleted.');
      setDelId(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot delete account head.'),
  });

  function openAdd(defaultCat) {
    setForm({ ...EMPTY, category: defaultCat && defaultCat !== 'ALL' ? defaultCat : 'EXPENSE' });
    setEditId(null);
    setModal('add');
  }

  function openEdit(head) {
    setForm({
      name: head.name,
      category: head.category,
      description: head.description || '',
    });
    setEditId(head.id);
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditId(null);
    setForm(EMPTY);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Account head name is required.');
      return;
    }
    saveMutation.mutate(form);
  }

  const allHeads = data?.data || [];
  const grouped = data?.grouped || { INCOME: [], EXPENSE: [], LIABILITY: [] };

  const filteredHeads = allHeads.filter((h) => {
    const matchesCategory = selectedCategory === 'ALL' || h.category === selectedCategory;
    const matchesSearch = !search || h.name.toLowerCase().includes(search.toLowerCase()) || (h.description && h.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryMeta = (cat) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Classify and track Expense, Income, and Liability account heads for your financial ledger"
        actions={
          <button id="add-account-head-btn" className="btn btn-primary" onClick={() => openAdd(selectedCategory)}>
            <Plus size={14} /> Add Account Head
          </button>
        }
      />

      {/* Category Summary KPIs */}
      <KpiGrid cols={3}>
        {CATEGORIES.map((cat) => {
          const count = grouped[cat.value]?.length || 0;
          return (
            <div
              key={cat.value}
              onClick={() => setSelectedCategory(selectedCategory === cat.value ? 'ALL' : cat.value)}
              style={{ cursor: 'pointer' }}
            >
              <KpiCard
                title={`${cat.label} Heads`}
                value={count}
                caption={selectedCategory === cat.value ? 'Filter active (click to clear)' : `Click to view ${cat.label.toLowerCase()} heads`}
                icon={cat.icon}
                accentColor={cat.accent}
                badge={selectedCategory === cat.value ? 'SELECTED' : 'CATEGORY'}
              />
            </div>
          );
        })}
      </KpiGrid>

      {/* Filter and Search Bar */}
      <div className="app-filter-bar">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${selectedCategory === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSelectedCategory('ALL')}
            >
              All Categories ({allHeads.length})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                className={`btn btn-sm ${selectedCategory === cat.value ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.label} ({grouped[cat.value]?.length || 0})
              </button>
            ))}
          </div>

          <div className="search-input-wrap" style={{ flex: '1 1 240px', maxWidth: 320, minWidth: 200, marginLeft: 'auto' }}>
            <Search size={14} />
            <input
              id="coa-search"
              type="text"
              className="form-input text-sm"
              placeholder="Search account heads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Account Heads Table */}
      <div className="app-table-card">
        <div className="flex items-center justify-between p-3 border-b border-border bg-subtle">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Account Head Registry</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt font-medium text-muted">
              {filteredHeads.length} heads
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Account Head Name</th>
                <th style={{ width: 140 }}>Category</th>
                <th>Description</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={5} rows={5} />
              ) : filteredHeads.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={Layers}
                      title="No account heads found"
                      description="Create account heads to classify cash book entries, expenses, and ledger postings."
                      actionLabel="+ Add Account Head"
                      onAction={() => openAdd(selectedCategory)}
                    />
                  </td>
                </tr>
              ) : (
                filteredHeads.map((h, idx) => {
                  const meta = getCategoryMeta(h.category);
                  const Icon = meta.icon;
                  return (
                    <tr key={h.id}>
                      <td className="text-muted text-xs">{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>
                        <div className="text-sm font-semibold text-text">
                          {h.name}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: `rgba(${meta.accent === 'rose' ? '239, 68, 68' : meta.accent === 'emerald' ? '16, 185, 129' : '59, 130, 246'}, 0.1)`,
                            color: meta.color,
                            border: `1px solid ${meta.color}40`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontWeight: 600,
                          }}
                        >
                          <Icon size={12} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="text-muted text-xs">{h.description || '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn-icon"
                            title="Edit"
                            onClick={() => openEdit(h)}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="btn-icon danger"
                            title="Delete"
                            onClick={() => setDelId(h.id)}
                          >
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
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-brand" />
                <span className="font-semibold text-base">{modal === 'add' ? 'Add New Account Head' : 'Edit Account Head'}</span>
              </div>
              <button className="btn-icon" onClick={closeModal}><X size={15} /></button>
            </div>
            <form onSubmit={handleSubmit} onKeyDown={(e) => handleFormEnterKey(e, handleSubmit)}>
              <div className="modal-body space-y-3">
                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Category *</label>
                  <select
                    id="coa-category"
                    className="form-select text-sm font-medium"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  >
                    <option value="EXPENSE">Expense (e.g. Salary, Rent, Utilities)</option>
                    <option value="INCOME">Income (e.g. Sales, Service Fee, Rebate)</option>
                    <option value="LIABILITY">Liability (e.g. Advance, Loan, Payable)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Account Head Name *</label>
                  <input
                    className="form-input text-sm"
                    placeholder="e.g. Office Rent, Electricity, Salaries"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Description / Notes</label>
                  <textarea
                    className="form-input text-sm"
                    rows={3}
                    placeholder="Optional notes or details about this account head..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : (modal === 'add' ? 'Create Account Head' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {delId && (
        <div className="modal-overlay" onClick={() => setDelId(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="font-semibold text-base">Confirm Deletion</span>
              <button className="btn-icon" onClick={() => setDelId(null)}><X size={15} /></button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted">Are you sure you want to delete this account head? It cannot be deleted if transactions are linked to it.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDelId(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(delId)}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
