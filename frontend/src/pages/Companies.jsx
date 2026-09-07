// ─────────────────────────────────────────────────────────────
// src/pages/Companies.jsx — Full CRUD for supplier companies
// + debounced search + server-side pagination
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesAPI } from '../api/services';
import useDebounce from '../utils/useDebounce';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
const EMPTY = { companyName: '', contactPerson: '', phone: '', address: '', openingBalance: '', town: '', sector: '', cnic: '' };
const PAGE_SIZE = 25;

export default function Companies() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['companies', debouncedSearch, page],
    queryFn: () => companiesAPI.list({ search: debouncedSearch, limit: PAGE_SIZE, page }).then((r) => r.data),
  });

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const saveMutation = useMutation({
    mutationFn: (d) => editId ? companiesAPI.update(editId, d) : companiesAPI.create(d),
    onSuccess: () => { qc.invalidateQueries(['companies']); toast.success(editId ? 'Company updated.' : 'Company added.'); closeModal(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Error saving company.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => companiesAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['companies']); toast.success('Company deleted.'); setDelId(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot delete company.'),
  });

  function openAdd() { setForm(EMPTY); setEditId(null); setModal('add'); }
  function openEdit(c) {
    setForm({
      companyName: c.companyName,
      contactPerson: c.contactPerson || '',
      phone: c.phone || '',
      address: c.address || '',
      openingBalance: c.openingBalance,
      town: c.town || '',
      sector: c.sector || '',
      cnic: c.cnic || '',
    });
    setEditId(c.id);
    setModal('edit');
  }
  function closeModal() { setModal(null); setEditId(null); }
  function set(f) { return (e) => setForm({ ...form, [f]: e.target.value }); }

  useEffect(() => {
    if (modal) {
      setTimeout(() => document.getElementById('comp-name')?.focus(), 80);
    }
  }, [modal]);

  const companies = data?.data || [];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Companies / Distributors</h2>
        <button id="add-company-btn" className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Company</button>
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input id="company-search" type="text" className="form-input" placeholder="Search by name, contact, phone..." value={search} onChange={handleSearch} />
        </div>
        <span className="text-muted">{data?.total || 0} companies</span>
      </div>

      <div className="card">
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Address</th>
                <th className="num">Opening Balance</th>
                <th className="num">Current Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No companies found</td></tr>
              ) : companies.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.companyName}</td>
                  <td>{c.contactPerson || '—'}</td>
                  <td>
                    <div>{c.phone || '—'}</div>
                    {c.cnic && <div className="text-muted text-xs">CNIC: {c.cnic}</div>}
                  </td>
                  <td className="text-muted text-sm">
                    {c.address || '—'}
                    {(c.town || c.sector) && (
                      <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                        {[c.town, c.sector].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="num tabular">{pkr(c.openingBalance)}</td>
                  <td className="num tabular" style={{ color: parseFloat(c.currentBalance) > 0 ? 'var(--alert)' : 'var(--paid)', fontWeight: 600 }}>
                    {pkr(c.currentBalance)}
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn-icon" onClick={() => openEdit(c)}><Pencil size={13} /></button>
                      <button className="btn-icon" onClick={() => setDelId(c.id)} style={{ color: 'var(--alert)' }}><Trash2 size={13} /></button>
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
            onKeyDown={(e) => handleFormEnterKey(e, () => { if (form.companyName) saveMutation.mutate(form); })}
          >
            <div className="modal-header">
              <span>{modal === 'add' ? 'Add Company' : 'Edit Company'}</span>
              <button className="btn-icon" onClick={closeModal}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <input id="comp-name" className="form-input" value={form.companyName} onChange={set('companyName')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input id="comp-contact" className="form-input" value={form.contactPerson} onChange={set('contactPerson')} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input id="comp-phone" className="form-input" value={form.phone} onChange={set('phone')} />
                </div>
                <div className="form-group">
                  <label className="form-label">CNIC</label>
                  <input id="comp-cnic" className="form-input" value={form.cnic || ''} onChange={set('cnic')} placeholder="e.g. 35201-1234567-1" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Town</label>
                  <input id="comp-town" className="form-input" value={form.town || ''} onChange={set('town')} placeholder="e.g. Industrial Area" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sector / Block</label>
                  <input id="comp-sector" className="form-input" value={form.sector || ''} onChange={set('sector')} placeholder="e.g. Phase 1" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Opening Balance (Rs)</label>
                  <input id="comp-ob" type="number" step="0.01" className="form-input" value={form.openingBalance} onChange={set('openingBalance')} disabled={!!editId} />
                  {editId && <span className="form-hint">Opening balance cannot be changed after creation.</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input id="comp-addr" className="form-input" value={form.address} onChange={set('address')} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button id="save-company-btn" className="btn btn-primary" disabled={saveMutation.isPending || !form.companyName}
                onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : modal === 'add' ? 'Save Company' : 'Update Company'}
              </button>
            </div>
          </div>
        </div>
      )}

      {delId && (
        <div className="modal-overlay" onClick={() => setDelId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Confirm Delete</div>
            <div className="modal-body"><p style={{ fontSize: 13 }}>Delete this company? This cannot be undone.</p></div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDelId(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(delId)}>
                {deleteMutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Delete Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
