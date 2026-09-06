// ─────────────────────────────────────────────────────────────
// src/pages/OfferLists.jsx
// Offer lists management, visual company-grouped view, print & exports
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { offerListsAPI, companiesAPI, productsAPI, exportAPI, downloadBlob } from '../api/services';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import {
  Plus, Search, FileDown, Printer, Eye, Edit2, Trash2,
  Tag, X, Check, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function getOfferBadgeClass(type) {
  switch (type) {
    case 'PERCENTAGE': return 'badge-offer';
    case 'NET': return 'badge-offer-net';
    case 'BONUS': return 'badge-offer-bonus';
    case 'TP': return 'badge-offer-tp';
    default: return 'badge-offer';
  }
}

export default function OfferLists() {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Search & filter
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewModal, setViewModal] = useState(false);
  const [selectedListId, setSelectedListId] = useState(null);

  // ── Form State for Create / Edit ──────────────────────────────
  const [formListNumber, setFormListNumber] = useState('');
  const [formListDate, setFormListDate] = useState(new Date().toISOString().split('T')[0]);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formRemarks, setFormRemarks] = useState('');
  const [formItems, setFormItems] = useState([]);

  // Sub-form for adding an item
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemOfferType, setItemOfferType] = useState('PERCENTAGE');
  const [itemOfferValue, setItemOfferValue] = useState('');
  const [itemBuyQty, setItemBuyQty] = useState('');
  const [itemFreeQty, setItemFreeQty] = useState('');
  const [itemRemarks, setItemRemarks] = useState('');
  const [inStockOnly, setInStockOnly] = useState(true);

  // ── Queries ───────────────────────────────────────────────────
  const { data: listData, isLoading } = useQuery({
    queryKey: ['offer-lists', search, activeFilter, page],
    queryFn: () =>
      offerListsAPI.list({
        search,
        isActive: activeFilter || undefined,
        page,
        limit: PAGE_SIZE,
      }).then((r) => r.data),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesAPI.list({ limit: 500 }).then((r) => r.data.data),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-all', inStockOnly],
    queryFn: () => productsAPI.list({ limit: 1000, inStockOnly: inStockOnly ? 'true' : undefined }).then((r) => r.data.data),
  });

  // Query single offer list for View modal
  const { data: singleListData, isLoading: isSingleLoading } = useQuery({
    queryKey: ['offer-list-detail', selectedListId],
    queryFn: () => offerListsAPI.get(selectedListId).then((r) => r.data.data),
    enabled: Boolean(selectedListId),
  });

  // ── Mutations ─────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId ? offerListsAPI.update(editingId, payload) : offerListsAPI.create(payload),
    onSuccess: (res) => {
      qc.invalidateQueries(['offer-lists']);
      qc.invalidateQueries(['active-offers']);
      toast.success(res.data.message || 'Offer list saved.');
      closeCreateModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error saving offer list.'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => offerListsAPI.toggleActive(id),
    onSuccess: (res) => {
      qc.invalidateQueries(['offer-lists']);
      qc.invalidateQueries(['active-offers']);
      toast.success(res.data.message);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error toggling status.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => offerListsAPI.delete(id),
    onSuccess: (res) => {
      qc.invalidateQueries(['offer-lists']);
      qc.invalidateQueries(['active-offers']);
      toast.success(res.data.message || 'Offer list deleted.');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting offer list.'),
  });

  // ── Handlers ──────────────────────────────────────────────────
  function openCreateModal(existing = null) {
    if (existing) {
      setEditingId(existing.id);
      setFormListNumber(existing.listNumber);
      setFormListDate(existing.listDate ? existing.listDate.split('T')[0] : '');
      setFormIsActive(existing.isActive);
      setFormRemarks(existing.remarks || '');
      // Fetch full details
      offerListsAPI.get(existing.id).then((r) => {
        const detail = r.data.data;
        const flatItems = detail.items.map((i) => ({
          companyId: i.companyId,
          companyName: i.company?.companyName || '—',
          productId: i.productId,
          productName: i.product?.productName || '—',
          offerType: i.offerType,
          offerValue: i.offerValue !== null ? String(i.offerValue) : '',
          bonusBuyQty: i.bonusBuyQty !== null ? String(i.bonusBuyQty) : '',
          bonusFreeQty: i.bonusFreeQty !== null ? String(i.bonusFreeQty) : '',
          remarks: i.remarks || '',
          offerLabel: i.offerLabel || '',
        }));
        setFormItems(flatItems);
      });
    } else {
      setEditingId(null);
      const nextNum = (listData?.total || 0) + 1;
      setFormListNumber(`OL-${String(nextNum).padStart(3, '0')}`);
      setFormListDate(new Date().toISOString().split('T')[0]);
      setFormIsActive(true);
      setFormRemarks('');
      setFormItems([]);
    }
    // Reset item input
    setSelectedCompanyId(companies[0]?.id || '');
    setSelectedProductId('');
    setItemOfferType('PERCENTAGE');
    setItemOfferValue('');
    setItemBuyQty('10');
    setItemFreeQty('1');
    setItemRemarks('');
    setCreateModal(true);
  }

  function closeCreateModal() {
    setCreateModal(false);
    setEditingId(null);
    setFormItems([]);
  }

  function handleAddItem() {
    if (!selectedCompanyId) {
      toast.error('Please select a company.');
      return;
    }
    if (!selectedProductId) {
      toast.error('Please select a product.');
      return;
    }
    if (formItems.some((i) => i.productId === selectedProductId)) {
      toast.error('This product is already in the list.');
      return;
    }

    if (itemOfferType === 'PERCENTAGE' && !itemOfferValue) {
      toast.error('Please enter the discount percentage (e.g. 5 for 5%).');
      return;
    }
    if (itemOfferType === 'NET' && !itemOfferValue) {
      toast.error('Please enter the net price (e.g. 1200).');
      return;
    }
    if (itemOfferType === 'BONUS' && (!itemBuyQty || !itemFreeQty)) {
      toast.error('Please enter both Buy Qty and Free Qty (e.g. 10 and 1).');
      return;
    }

    const company = companies.find((c) => c.id === selectedCompanyId);
    const product = products.find((p) => p.id === selectedProductId);

    let label = '';
    if (itemOfferType === 'PERCENTAGE') label = `${itemOfferValue}%`;
    else if (itemOfferType === 'TP') label = 'TP';
    else if (itemOfferType === 'NET') label = `${itemOfferValue} NET`;
    else if (itemOfferType === 'BONUS') label = `${itemBuyQty}+${itemFreeQty}`;

    const newItem = {
      companyId: selectedCompanyId,
      companyName: company?.companyName || '—',
      productId: selectedProductId,
      productName: product?.productName || '—',
      offerType: itemOfferType,
      offerValue: itemOfferType === 'PERCENTAGE' || itemOfferType === 'NET' ? itemOfferValue : null,
      bonusBuyQty: itemOfferType === 'BONUS' ? itemBuyQty : null,
      bonusFreeQty: itemOfferType === 'BONUS' ? itemFreeQty : null,
      remarks: itemRemarks.trim(),
      offerLabel: label,
    };

    setFormItems((prev) => [...prev, newItem]);
    setSelectedProductId('');
    setItemOfferValue('');
    setItemRemarks('');
    toast.success(`Added ${product?.productName} to list.`);
  }

  function handleRemoveItem(idx) {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSaveList() {
    if (!formListNumber.trim()) {
      toast.error('List Number is required.');
      return;
    }
    saveMutation.mutate({
      listNumber: formListNumber.trim(),
      listDate: formListDate,
      isActive: formIsActive,
      remarks: formRemarks,
      items: formItems.map((i) => ({
        companyId: i.companyId,
        productId: i.productId,
        offerType: i.offerType,
        offerValue: i.offerValue,
        bonusBuyQty: i.bonusBuyQty,
        bonusFreeQty: i.bonusFreeQty,
        remarks: i.remarks,
      })),
    });
  }

  async function exportDoc(id, type, listNumber) {
    try {
      const res = type === 'pdf' ? await exportAPI.offerListPDF(id) : await exportAPI.offerListExcel(id);
      downloadBlob(res, `OfferList-${listNumber}.${type === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch {
      toast.error('Export failed.');
    }
  }

  function openViewModal(id) {
    setSelectedListId(id);
    setViewModal(true);
  }

  const lists = listData?.data || [];
  const totalLists = listData?.total || 0;
  const activeLists = lists.filter((l) => l.isActive).length;

  return (
    <div>
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="page-header">
        <h2 className="page-title">Offer Lists</h2>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => openCreateModal()}>
            <Plus size={14} /> Create Offer List
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card brand">
          <div className="kpi-label">Active Lists</div>
          <div className="kpi-value">{activeLists}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Lists</div>
          <div className="kpi-value">{totalLists}</div>
        </div>
        <div className="kpi-card accent">
          <div className="kpi-label">Suppliers with Offers</div>
          <div className="kpi-value">
            {new Set(lists.flatMap((l) => l.items || []).map((i) => i.companyId)).size || companies.length}
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ──────────────────────────────────── */}
      <div className="card card-body" style={{ marginBottom: 14 }}>
        <div className="flex gap-12" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by list number or remarks..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div style={{ width: 160 }}>
            <select
              className="form-select"
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Offer Lists Table ────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span>Registered Offer Lists</span>
          <span className="text-muted text-sm">{totalLists} total</span>
        </div>
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>List #</th>
                <th style={{ width: 110 }}>List Date</th>
                <th style={{ width: 100 }} className="num">Companies</th>
                <th style={{ width: 90 }} className="num">Items</th>
                <th style={{ width: 110 }}>Status</th>
                <th>Remarks</th>
                <th style={{ width: 180 }} className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>
              ) : lists.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No offer lists found. Click "+ Create Offer List" to add company discount offers.
                  </td>
                </tr>
              ) : lists.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: 'monospace' }}>
                      {l.listNumber}
                    </span>
                  </td>
                  <td>{fmtDate(l.listDate)}</td>
                  <td className="num tabular">{l.companyCount || 0}</td>
                  <td className="num tabular">{l.itemCount || 0}</td>
                  <td>
                    <button
                      onClick={() => toggleMutation.mutate(l.id)}
                      className="btn-icon"
                      title={l.isActive ? 'Active (Click to deactivate)' : 'Inactive (Click to activate)'}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        border: '1px solid',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: l.isActive ? '#DCFCE7' : '#F3F4F6',
                        color: l.isActive ? '#166534' : '#6B7280',
                        borderColor: l.isActive ? '#BBF7D0' : '#E5E7EB',
                        cursor: 'pointer',
                      }}
                    >
                      {l.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {l.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {l.remarks || '—'}
                  </td>
                  <td className="num">
                    <div className="flex gap-4" style={{ justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 8px' }}
                        title="View / Print"
                        onClick={() => openViewModal(l.id)}
                      >
                        <Eye size={13} /> View
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 8px' }}
                        title="Edit List"
                        onClick={() => openCreateModal(l)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 8px' }}
                        title="Download PDF"
                        onClick={() => exportDoc(l.id, 'pdf', l.listNumber)}
                      >
                        <FileDown size={13} /> PDF
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 8px' }}
                        title="Download Excel"
                        onClick={() => exportDoc(l.id, 'excel', l.listNumber)}
                      >
                        <FileDown size={13} /> XLS
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 8px', color: 'var(--alert)', borderColor: '#FCA5A5' }}
                        title="Delete List"
                        onClick={() => {
                          if (window.confirm(`Delete offer list ${l.listNumber}?`)) {
                            deleteMutation.mutate(l.id);
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 16px' }}>
          <Pagination page={page} total={totalLists} limit={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {/* ── CREATE / EDIT MODAL ───────────────────────────────────── */}
      {createModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div
            className="modal"
            style={{ maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span>{editingId ? `Edit Offer List — ${formListNumber}` : 'Create New Offer List'}</span>
              <button className="btn-icon" onClick={closeCreateModal}><X size={15} /></button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              {/* Top metadata row */}
              <div className="grid-3" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">List Number *</label>
                  <input
                    id="ol-number-input"
                    type="text"
                    className="form-input"
                    value={formListNumber}
                    onChange={(e) => setFormListNumber(e.target.value)}
                    placeholder="e.g. OL-001"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">List Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formListDate}
                    onChange={(e) => setFormListDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                      />
                      <span>Active (Apply to Invoicing)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Remarks / Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="e.g. September Trade Offers, Eid Scheme..."
                />
              </div>

              {/* ── Add Item Sub-Form ── */}
              <div style={{ background: '#F8F9FA', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.04em' }}>
                  + Add Product Offer
                </div>

                <div className="grid-2" style={{ marginBottom: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Company / Distributor *</label>
                    <select
                      id="ol-company-select"
                      className="form-select"
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                      <option value="">-- Select Company --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.companyName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0 }}>Product *</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={inStockOnly}
                          onChange={(e) => setInStockOnly(e.target.checked)}
                        />
                        <span>In-Stock Only ({products.length})</span>
                      </label>
                    </div>
                    <select
                      id="ol-product-select"
                      className="form-select"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                      <option value="">-- Select Product ({products.length}) --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.productName} [Stock: {p.stockQty}] (TP: Rs {parseFloat(p.tradePrice || p.purchasePrice || p.salePrice || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Offer Type Selector */}
                <div className="grid-3" style={{ marginBottom: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Offer Type</label>
                    <select
                      id="ol-type-select"
                      className="form-select"
                      value={itemOfferType}
                      onChange={(e) => setItemOfferType(e.target.value)}
                    >
                      <option value="PERCENTAGE">Percentage Discount (%)</option>
                      <option value="TP">Trade Price (TP) — No Discount</option>
                      <option value="NET">Net Price Override (NET)</option>
                      <option value="BONUS">Bonus Scheme (e.g. 10+1)</option>
                    </select>
                  </div>

                  {/* Dynamic Value Input */}
                  {itemOfferType === 'PERCENTAGE' && (
                    <div className="form-group">
                      <label className="form-label">Discount Percentage (%)</label>
                      <input
                        id="ol-value-input"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="form-input"
                        placeholder="e.g. 5 for 5%"
                        value={itemOfferValue}
                        onChange={(e) => setItemOfferValue(e.target.value)}
                      />
                    </div>
                  )}

                  {itemOfferType === 'NET' && (
                    <div className="form-group">
                      <label className="form-label">Net Rate (Rs)</label>
                      <input
                        id="ol-value-input"
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="e.g. 1200"
                        value={itemOfferValue}
                        onChange={(e) => setItemOfferValue(e.target.value)}
                      />
                    </div>
                  )}

                  {itemOfferType === 'BONUS' && (
                    <div className="form-group">
                      <label className="form-label">Scheme (Buy + Free)</label>
                      <div className="flex gap-4">
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          placeholder="Buy (10)"
                          value={itemBuyQty}
                          onChange={(e) => setItemBuyQty(e.target.value)}
                        />
                        <span style={{ alignSelf: 'center', fontWeight: 700 }}>+</span>
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          placeholder="Free (1)"
                          value={itemFreeQty}
                          onChange={(e) => setItemFreeQty(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {itemOfferType === 'TP' && (
                    <div className="form-group">
                      <label className="form-label">Value</label>
                      <div style={{ height: 38, display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        Sold at Trade Price (0% discount)
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Remarks (optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. New Pack, Clearance"
                      value={itemRemarks}
                      onChange={(e) => setItemRemarks(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    id="ol-add-item-btn"
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAddItem}
                  >
                    <Plus size={13} /> Add to List
                  </button>
                </div>
              </div>

              {/* ── Added Items Table (grouped by company) ── */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Items in this Offer List</span>
                  <span className="badge badge-brand">{formItems.length} Products</span>
                </div>

                {formItems.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', background: '#FAFAFA', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12 }}>
                    No items added yet. Use the form above to add products.
                  </div>
                ) : (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Product</th>
                          <th style={{ width: 140 }}>Offer</th>
                          <th>Remarks</th>
                          <th style={{ width: 50 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formItems.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600, color: 'var(--brand)', fontSize: 12 }}>
                              {item.companyName}
                            </td>
                            <td>{item.productName}</td>
                            <td>
                              <span className={`badge ${getOfferBadgeClass(item.offerType)}`}>
                                {item.offerLabel}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {item.remarks || '—'}
                            </td>
                            <td>
                              <button
                                className="btn-icon"
                                style={{ color: 'var(--alert)' }}
                                onClick={() => handleRemoveItem(idx)}
                                title="Remove item"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeCreateModal}>Cancel</button>
              <button
                id="save-offer-list-btn"
                className="btn btn-primary"
                disabled={saveMutation.isPending || !formListNumber}
                onClick={handleSaveList}
              >
                {saveMutation.isPending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : (editingId ? 'Update List' : 'Save Offer List')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW / PRINT MODAL (Reference Software Layout) ───────── */}
      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span>Offer List Preview</span>
              <div className="flex gap-6">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => window.print()}
                >
                  <Printer size={13} /> Print
                </button>
                {singleListData && (
                  <>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => exportDoc(singleListData.id, 'pdf', singleListData.listNumber)}
                    >
                      <FileDown size={13} /> PDF
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => exportDoc(singleListData.id, 'excel', singleListData.listNumber)}
                    >
                      <FileDown size={13} /> Excel
                    </button>
                  </>
                )}
                <button className="btn-icon" onClick={() => setViewModal(false)}><X size={15} /></button>
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '24px 28px', background: '#FFFFFF' }}>
              {isSingleLoading ? (
                <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: 'auto' }} /></div>
              ) : !singleListData ? (
                <div>Could not load offer list.</div>
              ) : (
                <div id="offer-list-printable" style={{ fontFamily: 'monospace, sans-serif' }}>
                  {/* Reference Format Header */}
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 14 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.04em' }}>
                      {user?.businessName?.toUpperCase() || 'MEDICAL STORE'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, letterSpacing: '0.06em' }}>
                      OFFER LIST
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#333', marginTop: 8 }}>
                      <span>
                        <strong>List #</strong> {singleListData.listNumber} &nbsp;&nbsp;&nbsp;&nbsp;
                        <strong>List Date:</strong> {fmtDate(singleListData.listDate)}
                      </span>
                      <span>
                        <strong>Dated:</strong> {fmtDate(new Date())}
                      </span>
                    </div>
                  </div>

                  {/* Reference Format Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#222', color: '#fff', borderBottom: '2px solid #000' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', width: '50%' }}>ITEM</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', width: '22%' }}>OFFER</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', width: '28%' }}>REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(singleListData.companyGroups || []).map((group) => (
                        <tr key={group.companyId}>
                          <td colSpan={3} style={{ padding: 0 }}>
                            {/* Company Group Header Bar */}
                            <div
                              style={{
                                background: '#E8EBE9',
                                color: '#0F6E4F',
                                fontWeight: 800,
                                padding: '6px 8px',
                                borderTop: '1px solid #CCD2CE',
                                borderBottom: '1px solid #CCD2CE',
                                marginTop: 6,
                                fontSize: 12,
                                letterSpacing: '0.03em',
                              }}
                            >
                              {group.companyName.toUpperCase()} ({group.items.length})
                            </div>

                            {/* Products under company */}
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <tbody>
                                {group.items.map((item, idx) => (
                                  <tr
                                    key={item.id}
                                    style={{
                                      background: idx % 2 === 0 ? '#FFFFFF' : '#F9FBF9',
                                      borderBottom: '1px solid #EEEEEE',
                                    }}
                                  >
                                    <td style={{ padding: '5px 8px 5px 20px', width: '50%' }}>
                                      {item.productName}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '5px 8px', width: '22%', fontWeight: 700 }}>
                                      <span className={`badge ${getOfferBadgeClass(item.offerType)}`}>
                                        {item.offerLabel}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'left', padding: '5px 8px', width: '28%', color: '#555', fontSize: 11 }}>
                                      {item.remarks || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {singleListData.remarks && (
                    <div style={{ marginTop: 18, padding: 8, background: '#F5F5F0', borderRadius: 4, fontSize: 11, color: '#555' }}>
                      <strong>Notes:</strong> {singleListData.remarks}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
