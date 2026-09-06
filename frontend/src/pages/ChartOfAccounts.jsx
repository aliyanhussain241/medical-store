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

const CATEGORIES = [
  { value: 'EXPENSE', label: 'Expense', icon: TrendingDown, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
  { value: 'INCOME', label: 'Income', icon: TrendingUp, color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' },
  { value: 'LIABILITY', label: 'Liability', icon: ShieldAlert, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' },
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
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Chart of Accounts</h2>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Classify and track Expense, Income, and Liability account heads for your financial ledger.
          </p>
        </div>
        <button id="add-account-head-btn" className="btn btn-primary" onClick={() => openAdd(selectedCategory)}>
          <Plus size={14} /> Add Account Head
        </button>
      </div>

      {/* Category Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = grouped[cat.value]?.length || 0;
          const isSelected = selectedCategory === cat.value;
          return (
            <div
              key={cat.value}
              className="card"
              style={{
                cursor: 'pointer',
                border: isSelected ? `2px solid ${cat.color}` : '1px solid var(--border)',
                background: isSelected ? cat.bg : 'var(--surface)',
                padding: '16px 20px',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setSelectedCategory(selectedCategory === cat.value ? 'ALL' : cat.value)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: cat.bg,
                      color: cat.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{cat.label}</span>
                    <div className="text-muted text-xs">Category</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: cat.color }}>{count}</span>
                  <div className="text-muted text-xs">Heads</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="search-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${selectedCategory === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory('ALL')}
          >
            All Categories ({allHeads.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className={`btn btn-sm ${selectedCategory === cat.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCategory(cat.value)}
            >
              {cat.label} ({grouped[cat.value]?.length || 0})
            </button>
          ))}
        </div>

        <div className="search-input-wrap" style={{ maxWidth: 300, minWidth: 220 }}>
          <Search size={14} />
          <input
            id="coa-search"
            placeholder="Search account heads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Account Heads Table */}
      <div className="card">
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Account Head Name</th>
                <th>Category</th>
                <th>Description</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32 }}>
                    <div className="spinner" style={{ margin: 'auto' }} />
                  </td>
                </tr>
              ) : filteredHeads.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    <Layers size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <p>No account heads found. Click &quot;Add Account Head&quot; to create one.</p>
                  </td>
                </tr>
              ) : (
                filteredHeads.map((h, idx) => {
                  const meta = getCategoryMeta(h.category);
                  const Icon = meta.icon;
                  return (
                    <tr key={h.id}>
                      <td className="text-muted">{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{h.name}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: meta.bg,
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
                      <td className="text-muted text-sm">{h.description || '—'}</td>
                      <td>
                        <div className="action-btns">
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
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add New Account Head' : 'Edit Account Head'}</h3>
              <button className="btn-icon" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} onKeyDown={(e) => handleFormEnterKey(e, handleSubmit)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Category <span className="req">*</span></label>
                  <select
                    id="coa-category"
                    className="form-control"
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
                  <label className="form-label">Account Head Name <span className="req">*</span></label>
                  <input
                    className="form-control"
                    placeholder="e.g. Office Rent, Electricity, Salaries"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Optional notes or details about this account head..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
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
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Confirm Deletion</h3>
              <button className="btn-icon" onClick={() => setDelId(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this account head? It cannot be deleted if transactions are linked to it.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelId(null)}>Cancel</button>
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
