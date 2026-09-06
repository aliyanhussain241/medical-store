// ─────────────────────────────────────────────────────────────
// src/pages/Customers.jsx — Full CRUD for customers
// + debounced search + server-side pagination + skeletons & empty state
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersAPI, citiesAPI } from '../api/services';
import useDebounce from '../utils/useDebounce';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, X, Users, User, MapPin, DollarSign } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }

const EMPTY = {
  customerName: '',
  shopName: '',
  phone: '',
  address: '',
  openingBalance: '',
  customerCode: '',
  area: '',
  town: '',
  sector: '',
  cnic: '',
};
const PAGE_SIZE = 25;

export default function Customers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch, page],
    queryFn: () => customersAPI.list({ search: debouncedSearch, limit: PAGE_SIZE, page }).then((r) => r.data),
  });

  const { data: areasData } = useQuery({
    queryKey: ['customer-areas'],
    queryFn: () => customersAPI.areas().then((r) => r.data?.data || []),
  });

  const { data: managedCitiesData } = useQuery({
    queryKey: ['cities-all'],
    queryFn: () => citiesAPI.list({ limit: 100 }).then((r) => (r.data?.data || []).map((c) => c.cityName)),
  });

  // Combine areas from customer records and managed cities
  const existingAreas = Array.from(new Set([...(areasData || []), ...(managedCitiesData || [])])).filter(Boolean);

  // Reset to page 1 when search changes
  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const saveMutation = useMutation({
    mutationFn: (d) => editId ? customersAPI.update(editId, d) : customersAPI.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['customers']);
      qc.invalidateQueries(['customer-areas']);
      toast.success(editId ? 'Customer updated.' : 'Customer added.');
      closeModal();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error saving customer.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => customersAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['customers']);
      qc.invalidateQueries(['customer-areas']);
      toast.success('Customer deleted.');
      setDelId(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot delete customer.'),
  });

  function openAdd() { setForm(EMPTY); setEditId(null); setModal('add'); }
  function openEdit(c) {
    setForm({
      customerName: c.customerName,
      shopName: c.shopName || '',
      phone: c.phone || '',
      address: c.address || '',
      openingBalance: c.openingBalance,
      customerCode: c.customerCode || '',
      area: c.area || '',
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
      setTimeout(() => document.getElementById('cust-name')?.focus(), 80);
    }
  }, [modal]);

  const customers = data?.data || [];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Customers</h2>
        <button id="add-customer-btn" className="btn btn-primary" onClick={openAdd}>
          <Plus size={14} /> Add Customer
        </button>
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input
            id="customer-search"
            placeholder="Search by code, name, shop, area, phone..."
            value={search}
            onChange={handleSearch}
          />
        </div>
        <span className="text-muted">{data?.total || 0} customers</span>
      </div>

      <div className="card">
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Code</th>
                <th>Customer Name</th>
                <th>Area / City</th>
                <th>Shop Name</th>
                <th>Mobile Number</th>
                <th>Address</th>
                <th className="num">Opening Balance</th>
                <th className="num">Current Balance</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map((idx) => (
                  <tr key={idx}>
                    <td><div className="skeleton skeleton-text" style={{ width: 42 }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: 140 }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: 85 }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: 100 }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: 90 }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: 120 }} /></td>
                    <td className="num"><div className="skeleton skeleton-text" style={{ width: 60, marginLeft: 'auto' }} /></td>
                    <td className="num"><div className="skeleton skeleton-text" style={{ width: 60, marginLeft: 'auto' }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: 50 }} /></td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 0 }}>
                    <div className="empty-state-box">
                      <div className="empty-state-icon-wrap">
                        <Users size={24} />
                      </div>
                      <div className="empty-state-title">
                        {search ? 'No matching customers found' : 'No customers added yet'}
                      </div>
                      <div className="empty-state-desc">
                        {search
                          ? `No customer records match "${search}". Try searching by code, area, or name.`
                          : 'Add your first wholesale customer to start creating invoices and recording ledger transactions.'}
                      </div>
                      {!search && (
                        <button className="btn btn-primary btn-sm" onClick={openAdd}>
                          <Plus size={13} /> Add First Customer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        background: 'var(--bg, #F6F8F6)',
                        border: '1px solid var(--border-light, #EBF0EC)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontSize: '11.5px',
                        color: 'var(--text)'
                      }}>
                        {c.customerCode || '—'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.customerName}</td>
                    <td>
                      {c.area ? (
                        <span style={{
                          display: 'inline-block',
                          background: 'rgba(37, 99, 235, 0.08)',
                          color: '#2563EB',
                          border: '1px solid rgba(37, 99, 235, 0.18)',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '10.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em'
                        }}>
                          {c.area}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                      {(c.town || c.sector) && (
                        <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                          {[c.town, c.sector].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </td>
                    <td>{c.shopName || '—'}</td>
                    <td>
                      <div>{c.phone || '—'}</div>
                      {c.cnic && <div className="text-muted text-xs">CNIC: {c.cnic}</div>}
                    </td>
                    <td className="text-muted text-sm">{c.address || '—'}</td>
                    <td className="num tabular">{pkr(c.openingBalance)}</td>
                    <td className="num tabular" style={{ color: parseFloat(c.currentBalance) > 0 ? 'var(--alert)' : 'var(--paid)', fontWeight: 700 }}>
                      {pkr(c.currentBalance)}
                    </td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn-icon" onClick={() => openEdit(c)} title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button className="btn-icon" onClick={() => setDelId(c.id)} title="Delete" style={{ color: 'var(--alert)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 16px' }}>
          <Pagination page={page} total={data?.total || 0} limit={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleFormEnterKey(e, () => { if (form.customerName) saveMutation.mutate(form); })}
          >
            <div className="modal-header">
              <span>{modal === 'add' ? 'Add New Customer' : 'Edit Customer Details'}</span>
              <button className="btn-icon" onClick={closeModal}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-section-title">
                <User size={13} /> Basic Information
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input id="cust-name" className="form-input" value={form.customerName} onChange={set('customerName')} required placeholder="e.g. Al-Madina Medical" />
                </div>
                <div className="form-group">
                  <label className="form-label">Shop Name</label>
                  <input id="cust-shop" className="form-input" value={form.shopName} onChange={set('shopName')} placeholder="e.g. Al-Madina Pharmacy" />
                </div>
              </div>

              <div className="form-section-title">
                <MapPin size={13} /> Location & Code
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Customer Code</label>
                  <input
                    id="cust-code"
                    className="form-input"
                    placeholder="e.g. 101 (Auto if blank)"
                    value={form.customerCode || ''}
                    onChange={set('customerCode')}
                  />
                  <span className="form-hint">Numeric code for reports (auto-assigned if left blank)</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Area / City</label>
                  <input
                    id="cust-area"
                    className="form-input"
                    list="area-suggestions"
                    placeholder="e.g. MORO, BHIRYA CITY"
                    value={form.area || ''}
                    onChange={set('area')}
                  />
                  <datalist id="area-suggestions">
                    {existingAreas.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                  <span className="form-hint">Group territory for Party Balance report</span>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Town</label>
                  <input id="cust-town" className="form-input" value={form.town || ''} onChange={set('town')} placeholder="e.g. Model Town" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sector / Block</label>
                  <input id="cust-sector" className="form-input" value={form.sector || ''} onChange={set('sector')} placeholder="e.g. Sector 4, Block B" />
                </div>
              </div>

              <div className="form-section-title">
                <DollarSign size={13} /> Financial & Contact
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input id="cust-phone" className="form-input" value={form.phone} onChange={set('phone')} placeholder="e.g. 0300-1234567" />
                </div>
                <div className="form-group">
                  <label className="form-label">CNIC</label>
                  <input id="cust-cnic" className="form-input" value={form.cnic || ''} onChange={set('cnic')} placeholder="e.g. 35201-1234567-1" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Opening Balance (Rs)</label>
                  <input id="cust-ob" type="number" step="0.01" className="form-input" value={form.openingBalance} onChange={set('openingBalance')} disabled={!!editId} placeholder="0.00" />
                  {editId && <span className="form-hint">Opening balance cannot be changed after creation.</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input id="cust-addr" className="form-input" value={form.address} onChange={set('address')} placeholder="Shop address / street..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button id="save-customer-btn" className="btn btn-primary" disabled={saveMutation.isPending || !form.customerName}
                onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : modal === 'add' ? 'Save Customer' : 'Update Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {delId && (
        <div className="modal-overlay" onClick={() => setDelId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Confirm Delete</div>
            <div className="modal-body">
              <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                Are you sure you want to delete this customer? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDelId(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(delId)}>
                {deleteMutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Delete Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
