// ─────────────────────────────────────────────────────────────
// src/pages/Inventory.jsx — Products with alerts, batch, expiry
// + debounced search + server-side pagination
// + business-type config-driven UI
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsAPI } from '../api/services';
import useDebounce from '../utils/useDebounce';
import Pagination from '../components/Pagination';
import ImportExcelModal from '../components/ImportExcelModal';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, X, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';
import { useBusinessConfig } from '../context/BusinessConfigContext';

const PAGE_SIZE = 25;

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-PK') : '—'; }
function pkr(v) { return `Rs ${parseFloat(v || 0).toFixed(2)}`; }

export default function Inventory() {
  const cfg = useBusinessConfig();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all'); // all | lowStock | nearExpiry
  const [modal, setModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [adjModal, setAdjModal] = useState(null);
  const [adjQty, setAdjQty] = useState('');

  // Build empty form based on config defaults
  const emptyForm = () => ({
    productName: '', category: '', unit: cfg.defaultUnit,
    batchNo: '', expiryDate: '', purchasePrice: '',
    tradePrice: '', salePrice: '', stockQty: '', minStockAlert: 10,
  });
  const [form, setForm] = useState(emptyForm);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['products', debouncedSearch, filter, page],
    queryFn: () => productsAPI.list({
      search: debouncedSearch, limit: PAGE_SIZE, page,
      lowStock: filter === 'lowStock' ? 'true' : undefined,
      nearExpiry: filter === 'nearExpiry' ? 'true' : undefined,
    }).then((r) => r.data),
  });

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };
  const handleFilterChange = (e) => { setFilter(e.target.value); setPage(1); };

  const saveMutation = useMutation({
    mutationFn: (d) => editId ? productsAPI.update(editId, d) : productsAPI.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['products']);
      toast.success(editId ? `${cfg.productLabel} updated.` : `${cfg.productLabel} added.`);
      closeModal();
    },
    onError: (e) => toast.error(e.response?.data?.message || `Error saving ${cfg.productLabel.toLowerCase()}.`),
  });

  const adjMutation = useMutation({
    mutationFn: ({ id, qty }) => productsAPI.adjustStock(id, qty, 'Manual adjustment'),
    onSuccess: () => {
      qc.invalidateQueries(['products']);
      toast.success('Stock adjusted.');
      setAdjModal(null);
      setAdjQty('');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot adjust stock.'),
  });

  function openAdd() { setForm(emptyForm()); setEditId(null); setModal('add'); }
  function openEdit(p) {
    setForm({
      productName: p.productName,
      category: p.category || '',
      unit: p.unit,
      batchNo: p.batchNo || '',
      expiryDate: p.expiryDate ? p.expiryDate.split('T')[0] : '',
      purchasePrice: p.purchasePrice,
      tradePrice: p.tradePrice || p.purchasePrice,
      salePrice: p.salePrice,
      stockQty: p.stockQty,
      minStockAlert: p.minStockAlert,
    });
    setEditId(p.id);
    setModal('edit');
  }
  function closeModal() { setModal(null); setEditId(null); }
  function set(f) { return (e) => setForm((prev) => ({ ...prev, [f]: e.target.value })); }

  useEffect(() => {
    if (modal) {
      setTimeout(() => document.getElementById('prod-name')?.focus(), 80);
    }
  }, [modal]);

  // When cfg changes (on login) reset form defaults
  useEffect(() => { setForm(emptyForm()); }, [cfg.typeKey]);

  const products = data?.data || [];

  // Dynamic column count for colSpan
  const colCount = 6
    + (cfg.showBatchNo ? 1 : 0)
    + (cfg.showExpiryDate ? 1 : 0)
    + (cfg.showTradePrice ? 1 : 0);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{cfg.productsLabel} / Inventory</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button id="import-excel-btn" className="btn btn-outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet size={14} /> Import Excel
          </button>
          <button id="add-product-btn" className="btn btn-primary" onClick={openAdd}>
            <Plus size={14} /> Add {cfg.productLabel}
          </button>
        </div>
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input
            id="product-search"
            type="text"
            className="form-input"
            placeholder={`Search by name${cfg.showBatchNo ? ', batch' : ''}, category...`}
            value={search}
            onChange={handleSearch}
          />
        </div>
        <select className="form-select" style={{ width: 160 }} value={filter} onChange={handleFilterChange} id="product-filter">
          <option value="all">All {cfg.productsLabel}</option>
          <option value="lowStock">⚠ Low Stock</option>
          {cfg.showNearExpiryFilter && <option value="nearExpiry">⏰ Near Expiry</option>}
        </select>
        <span className="text-muted">{data?.total || 0} {cfg.productsLabel.toLowerCase()}</span>
      </div>

      <div className="card">
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{cfg.productLabel}</th>
                <th>Category</th>
                {cfg.showBatchNo && <th>Batch</th>}
                {cfg.showExpiryDate && <th>Expiry</th>}
                <th className="num">{cfg.costLabel}</th>
                {cfg.showTradePrice && <th className="num">{cfg.tradePriceLabel}</th>}
                <th className="num">{cfg.salePriceLabel}</th>
                <th className="num">Stock</th>
                <th>Alert</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No {cfg.productsLabel.toLowerCase()} found</td></tr>
              ) : products.map((p) => (
                <tr key={p.id} style={{ background: p.isLowStock ? '#FFF9F9' : undefined }}>
                  <td style={{ fontWeight: 600 }}>
                    {p.productName}
                    {p.isExpired && <span className="badge badge-overdue" style={{ marginLeft: 6, fontSize: 10 }}>EXPIRED</span>}
                  </td>
                  <td className="text-muted">{p.category || '—'}</td>
                  {cfg.showBatchNo && <td className="text-sm">{p.batchNo || '—'}</td>}
                  {cfg.showExpiryDate && (
                    <td className="text-sm" style={{ color: p.isNearExpiry ? 'var(--alert)' : undefined }}>
                      {fmtDate(p.expiryDate)}
                      {p.isNearExpiry && !p.isExpired && <AlertTriangle size={11} style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
                    </td>
                  )}
                  <td className="num tabular">{pkr(p.purchasePrice)}</td>
                  {cfg.showTradePrice && (
                    <td className="num tabular" style={{ fontWeight: 600, color: 'var(--primary, #2563eb)' }}>
                      {pkr(p.tradePrice || p.purchasePrice)}
                    </td>
                  )}
                  <td className="num tabular" style={{ fontWeight: 600 }}>{pkr(p.salePrice)}</td>
                  <td className="num tabular" style={{ fontWeight: 700, color: p.isLowStock ? 'var(--alert)' : 'var(--brand)' }}>
                    {parseFloat(p.stockQty)} {p.unit}
                    {p.isLowStock && <AlertTriangle size={11} style={{ marginLeft: 4 }} />}
                  </td>
                  <td className="text-muted text-sm">{p.minStockAlert} {p.unit}</td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn-icon btn-sm" onClick={() => { setAdjModal(p); setAdjQty(''); }} title="Adjust Stock" style={{ fontSize: 11, padding: '3px 8px', fontWeight: 600 }}>±Qty</button>
                      <button className="btn-icon" onClick={() => openEdit(p)}><Pencil size={13} /></button>
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

      {/* Excel import modal */}
      {importOpen && <ImportExcelModal onClose={() => setImportOpen(false)} />}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal modal-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleFormEnterKey(e, () => { if (form.productName && form.purchasePrice && form.salePrice) saveMutation.mutate(form); })}
          >
            <div className="modal-header">
              <span>{modal === 'add' ? `Add ${cfg.productLabel}` : `Edit ${cfg.productLabel}`}</span>
              <button className="btn-icon" onClick={closeModal}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">{cfg.productLabel} Name *</label>
                  <input id="prod-name" className="form-input" value={form.productName} onChange={set('productName')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input id="prod-cat" className="form-input" placeholder={cfg.categoryPlaceholder} value={form.category} onChange={set('category')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select id="prod-unit" className="form-select" value={form.unit} onChange={set('unit')}>
                    {cfg.unitOptions.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                {cfg.showBatchNo && (
                  <div className="form-group">
                    <label className="form-label">Batch No</label>
                    <input id="prod-batch" className="form-input" value={form.batchNo} onChange={set('batchNo')} />
                  </div>
                )}
                {cfg.showExpiryDate && (
                  <div className="form-group">
                    <label className="form-label">Expiry Date</label>
                    <input id="prod-expiry" type="date" className="form-input" value={form.expiryDate} onChange={set('expiryDate')} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{cfg.costLabel} (Rs) *</label>
                  <input id="prod-pp" type="number" step="0.01" min="0" className="form-input" value={form.purchasePrice} onChange={set('purchasePrice')} required />
                </div>
                {cfg.showTradePrice && (
                  <div className="form-group">
                    <label className="form-label">{cfg.tradePriceLabel} (Rs)</label>
                    <input id="prod-tp" type="number" step="0.01" min="0" className="form-input" placeholder="Wholesale TP (Defaults to Cost)" value={form.tradePrice || ''} onChange={set('tradePrice')} />
                    <span className="form-hint">Used for TP invoicing</span>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{cfg.salePriceLabel} (Rs) *</label>
                  <input id="prod-sp" type="number" step="0.01" min="0" className="form-input" value={form.salePrice} onChange={set('salePrice')} required />
                  <span className="form-hint">Locked / read-only during billing</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input id="prod-qty" type="number" step="0.001" min="0" className="form-input" value={form.stockQty} onChange={set('stockQty')} disabled={!!editId} />
                  {editId && <span className="form-hint">Use "±Qty" button to adjust existing stock.</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Low Stock Alert Below</label>
                  <input id="prod-alert" type="number" step="1" min="0" className="form-input" value={form.minStockAlert} onChange={set('minStockAlert')} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button id="save-product-btn" className="btn btn-primary" disabled={saveMutation.isPending || !form.productName}
                onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending
                  ? <span className="spinner" style={{ borderTopColor: '#fff' }} />
                  : modal === 'add' ? `Save ${cfg.productLabel}` : `Update ${cfg.productLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjModal && (
        <div className="modal-overlay" onClick={() => setAdjModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>Adjust Stock — {adjModal.productName}</span>
              <button className="btn-icon" onClick={() => setAdjModal(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: 12 }}>Current stock: <strong>{parseFloat(adjModal.stockQty)} {adjModal.unit}</strong></p>
              <div className="form-group">
                <label className="form-label">Quantity to Add / Subtract</label>
                <input
                  id="adj-qty"
                  type="number"
                  step="0.001"
                  className="form-input"
                  placeholder="e.g. +50 or -10"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && adjQty && !adjMutation.isPending) {
                      e.preventDefault();
                      adjMutation.mutate({ id: adjModal.id, qty: adjQty });
                    }
                  }}
                  autoFocus
                />
                <span className="form-hint">Use negative value (e.g. -5) to reduce stock.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setAdjModal(null)}>Cancel</button>
              <button id="adj-stock-btn" className="btn btn-primary" disabled={adjMutation.isPending || !adjQty}
                onClick={() => adjMutation.mutate({ id: adjModal.id, qty: adjQty })}>
                {adjMutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
