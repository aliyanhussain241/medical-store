// ─────────────────────────────────────────────────────────────
// src/pages/Cities.jsx — Management of Cities / Areas
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { citiesAPI } from '../api/services';
import useDebounce from '../utils/useDebounce';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, X, MapPin } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';

const PAGE_SIZE = 25;

export default function Cities() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [cityName, setCityName] = useState('');
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['cities', debouncedSearch, page],
    queryFn: () => citiesAPI.list({ search: debouncedSearch, limit: PAGE_SIZE, page }).then((r) => r.data),
  });

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const saveMutation = useMutation({
    mutationFn: (name) => editId ? citiesAPI.update(editId, { cityName: name }) : citiesAPI.create({ cityName: name }),
    onSuccess: () => {
      qc.invalidateQueries(['cities']);
      qc.invalidateQueries(['customer-areas']);
      toast.success(editId ? 'City updated successfully.' : 'City added successfully.');
      closeModal();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error saving city.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => citiesAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['cities']);
      qc.invalidateQueries(['customer-areas']);
      toast.success('City deleted.');
      setDelId(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot delete city.'),
  });

  function openAdd() {
    setCityName('');
    setEditId(null);
    setModal('add');
  }

  function openEdit(c) {
    setCityName(c.cityName);
    setEditId(c.id);
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditId(null);
    setCityName('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!cityName.trim()) {
      toast.error('City name is required.');
      return;
    }
    saveMutation.mutate(cityName.trim());
  }

  const cities = data?.data || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Cities / Areas</h2>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Manage the list of cities and regions used for categorizing customers and ledgers.
          </p>
        </div>
        <button id="add-city-btn" className="btn btn-primary" onClick={openAdd}>
          <Plus size={14} /> Add City
        </button>
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input
            id="city-search"
            type="text"
            className="form-input"
            placeholder="Search by city name..."
            value={search}
            onChange={handleSearch}
          />
        </div>
        <span className="text-muted">{data?.total || cities.length} cities</span>
      </div>

      <div className="card">
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>City / Area Name</th>
                <th>Created At</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 32 }}>
                    <div className="spinner" style={{ margin: 'auto' }} />
                  </td>
                </tr>
              ) : cities.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    <MapPin size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <p>No cities found. Click &quot;Add City&quot; to create one.</p>
                  </td>
                </tr>
              ) : (
                cities.map((c, idx) => (
                  <tr key={c.id}>
                    <td className="text-muted">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span>{c.cityName}</span>
                      </div>
                    </td>
                    <td className="text-muted text-sm">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="btn-icon"
                          title="Edit"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Delete"
                          onClick={() => setDelId(c.id)}
                        >
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

        {data?.totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <Pagination
              currentPage={page}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add New City / Area' : 'Edit City / Area'}</h3>
              <button className="btn-icon" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} onKeyDown={(e) => handleFormEnterKey(e, handleSubmit)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">City / Area Name <span className="req">*</span></label>
                  <input
                    id="city-name-input"
                    className="form-control"
                    placeholder="e.g. Lahore, Rawalpindi, Faisalabad"
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    autoFocus
                    required
                  />
                  <span className="text-muted text-xs" style={{ marginTop: 4, display: 'block' }}>
                    This will appear in customer registration and area-filtered reports.
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : (modal === 'add' ? 'Add City' : 'Save Changes')}
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
              <p>Are you sure you want to remove this city? Existing customers with this area name will still retain their value.</p>
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
