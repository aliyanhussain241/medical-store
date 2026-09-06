// ─────────────────────────────────────────────────────────────
// src/pages/Purchasing.jsx — Purchase orders from distributors
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import useDebounce from '../utils/useDebounce';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesAPI, productsAPI, purchasesAPI, bankAccountsAPI } from '../api/services';
import toast from 'react-hot-toast';
import { Plus, Search, Trash2, X, DollarSign, Landmark } from 'lucide-react';

function pkr(v) { return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`; }
function calcLine(qty, price, disc) {
  const q = parseFloat(qty) || 0, p = parseFloat(price) || 0, d = parseFloat(disc) || 0;
  return q * p * (1 - d / 100);
}
function statusBadge(s) {
  const map = { PAID: 'paid', PENDING: 'pending', PARTIAL: 'partial' };
  return <span className={`badge badge-${map[s] || 'pending'}`}>{s}</span>;
}
function fmtDate(d) { return new Date(d).toLocaleDateString('en-PK'); }

export default function Purchasing() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('new'); // 'new' | 'history'
  const [companyId, setCompanyId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [highlightedProductIdx, setHighlightedProductIdx] = useState(0);
  const [narration, setNarration] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [bankAccountId, setBankAccountId] = useState('');
  const debouncedProductSearch = useDebounce(productSearch, 300);
  const [payModal, setPayModal] = useState(null); // purchase to pay

  useEffect(() => {
    setHighlightedProductIdx(0);
  }, [debouncedProductSearch]);

  useEffect(() => {
    if (tab === 'new') {
      const compEl = document.getElementById('po-company');
      if (compEl) compEl.focus();
    }
  }, [tab]);

  const { data: compData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesAPI.list({ limit: 500 }).then((r) => r.data.data),
  });

  const { data: prodData } = useQuery({
    queryKey: ['products-srch-po', debouncedProductSearch],
    queryFn: () => productsAPI.list({ search: debouncedProductSearch, limit: 20 }).then((r) => r.data.data),
    enabled: debouncedProductSearch.length > 0,
  });

  const { data: histData } = useQuery({
    queryKey: ['purchases-hist'],
    queryFn: () => purchasesAPI.list({ limit: 50 }).then((r) => r.data),
    enabled: tab === 'history',
  });

  const { data: bankAccData } = useQuery({
    queryKey: ['bank-accounts-all'],
    queryFn: () => bankAccountsAPI.list({ limit: 500 }).then((r) => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (d) => purchasesAPI.create(d),
    onSuccess: () => {
      toast.success('Purchase order saved!');
      setItems([]); setCompanyId(''); setPaidAmount(''); setNarration(''); setPaymentMethod('CASH'); setBankAccountId('');
      qc.invalidateQueries(['products']); qc.invalidateQueries(['dashboard']);
      qc.invalidateQueries(['purchases-hist']); qc.invalidateQueries(['bank-accounts']);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error saving purchase.'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amount, paymentMethod, bankAccountId }) => purchasesAPI.recordPayment(id, { amount, paymentMethod, bankAccountId }),
    onSuccess: () => { qc.invalidateQueries(['purchases-hist']); toast.success('Payment recorded.'); setPayModal(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Payment error.'),
  });

  function addProduct(p) {
    if (items.find((i) => i.productId === p.id)) { toast('Already added.', { icon: 'ℹ️' }); return; }
    setItems((prev) => [...prev, { productId: p.id, productName: p.productName, unit: p.unit, qty: 1, unitPrice: parseFloat(p.purchasePrice), discount: 0 }]);
    setProductSearch('');
  }
  function updateItem(idx, field, value) { setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item)); }
  function removeItem(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  const totalAmount = items.reduce((s, i) => s + calcLine(i.qty, i.unitPrice, i.discount), 0);
  const paid = parseFloat(paidAmount) || 0;

  function handleSave() {
    if (!companyId) { toast.error('Select a company/distributor.'); return; }
    if (items.length === 0) { toast.error('Add at least one product.'); return; }
    saveMutation.mutate({
      companyId, purchaseDate, paidAmount: paid,
      paymentMethod,
      bankAccountId: paymentMethod === 'BANK' ? bankAccountId : undefined,
      narration: narration.trim() || undefined,
      items: items.map((i) => ({ productId: i.productId, qty: parseFloat(i.qty), unitPrice: parseFloat(i.unitPrice), discount: parseFloat(i.discount) || 0 })),
    });
  }

  const companies = compData || [];
  const products = prodData || [];
  const history = histData?.data || [];
  const bankAccounts = bankAccData || [];

  const tabStyle = (t) => ({
    padding: '7px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600, border: 'none', background: 'none',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
  });

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Purchasing</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        <button id="tab-new-po" style={tabStyle('new')} onClick={() => setTab('new')}>New Purchase Order</button>
        <button id="tab-history" style={tabStyle('history')} onClick={() => setTab('history')}>Purchase History</button>
      </div>

      {tab === 'new' ? (
        <div className="pos-layout">
          <div className="pos-left">
            <div className="card card-body">
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Company / Distributor *</label>
                  <select
                    id="po-company"
                    className="form-select"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('po-prod-search')?.focus();
                      }
                    }}
                  >
                    <option value="">— Select Company —</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Purchase Date</label>
                  <input
                    id="po-date"
                    type="date"
                    className="form-input"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('po-prod-search')?.focus();
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">Add Products</div>
              <div className="card-body" style={{ paddingBottom: 0 }}>
                <div className="search-input-wrap" style={{ maxWidth: '100%', marginBottom: 10 }}>
                  <Search size={14} />
                  <input
                    id="po-prod-search"
                    placeholder="Search product... (Press Enter to add, or Enter on empty to pay)"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (products.length > 0) setHighlightedProductIdx((prev) => (prev + 1) % products.length);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (products.length > 0) setHighlightedProductIdx((prev) => (prev - 1 + products.length) % products.length);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (products.length > 0 && productSearch.trim().length > 0) {
                          const chosen = products[highlightedProductIdx] || products[0];
                          if (chosen) {
                            addProduct(chosen);
                            setProductSearch('');
                            setTimeout(() => {
                              const lastQty = document.querySelector('.po-qty-input-last');
                              if (lastQty) { lastQty.focus(); lastQty.select(); }
                            }, 60);
                          }
                        } else if (!productSearch.trim() && items.length > 0) {
                          const paidEl = document.getElementById('po-paid');
                          if (paidEl && paymentMethod !== 'CASH') {
                            paidEl.focus();
                            paidEl.select();
                          } else {
                            document.getElementById('save-po-btn')?.focus();
                          }
                        }
                      }
                    }}
                  />
                </div>
                {products.length > 0 && productSearch && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
                    {products.map((p, pIdx) => {
                      const isSelected = pIdx === highlightedProductIdx;
                      return (
                        <div
                          key={p.id}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 13,
                            background: isSelected ? 'rgba(37, 99, 235, 0.09)' : undefined,
                            borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                          }}
                          onClick={() => {
                            addProduct(p);
                            setProductSearch('');
                            setTimeout(() => {
                              const lastQty = document.querySelector('.po-qty-input-last');
                              if (lastQty) { lastQty.focus(); lastQty.select(); }
                            }, 60);
                          }}
                          onMouseEnter={() => setHighlightedProductIdx(pIdx)}
                        >
                          <span style={{ fontWeight: isSelected ? 700 : 600 }}>{p.productName}</span>
                          <span className="text-muted">{pkr(p.purchasePrice)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">Line Items <span className="text-muted text-sm">{items.length}</span></div>
              <div className="data-table-wrap" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit Price</th>
                      <th className="num">Disc %</th>
                      <th className="num">Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Add products above</td></tr>
                    ) : items.map((item, idx) => (
                      <tr key={item.productId}>
                        <td style={{ fontWeight: 500 }}>{item.productName} <span className="text-muted text-sm">/ {item.unit}</span></td>
                        <td className="num">
                          <input
                            id={`po-item-qty-${idx}`}
                            type="number"
                            min="0.001"
                            step="0.001"
                            className={`form-input tabular ${idx === items.length - 1 ? 'po-qty-input-last' : ''}`}
                            style={{ width: 70, padding: '4px 6px', textAlign: 'right' }}
                            value={item.qty}
                            onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const pEl = document.getElementById(`po-item-price-${idx}`);
                                if (pEl) { pEl.focus(); pEl.select(); }
                              }
                            }}
                          />
                        </td>
                        <td className="num">
                          <input
                            id={`po-item-price-${idx}`}
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input tabular"
                            style={{ width: 90, padding: '4px 6px', textAlign: 'right' }}
                            value={item.unitPrice}
                            onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const dEl = document.getElementById(`po-item-disc-${idx}`);
                                if (dEl) { dEl.focus(); dEl.select(); }
                              }
                            }}
                          />
                        </td>
                        <td className="num">
                          <input
                            id={`po-item-disc-${idx}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            className="form-input"
                            style={{ width: 60, padding: '4px 6px', textAlign: 'right' }}
                            value={item.discount}
                            onChange={(e) => updateItem(idx, 'discount', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                document.getElementById('po-prod-search')?.focus();
                              }
                            }}
                          />
                        </td>
                        <td className="num tabular" style={{ fontWeight: 600 }}>{pkr(calcLine(item.qty, item.unitPrice, item.discount))}</td>
                        <td><button className="btn-icon" onClick={() => removeItem(idx)} style={{ color: 'var(--alert)' }}><Trash2 size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="pos-right">
            <div className="pos-total-box">
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purchase Summary</div>
              <div className="pos-total-row grand">{pkr(totalAmount)}</div>
            </div>
            <div className="card card-body">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className={`btn btn-sm ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setPaymentMethod('CASH'); setBankAccountId(''); }}
                    style={{ flex: 1 }}
                  >
                    💵 Cash
                  </button>
                  <button
                    className={`btn btn-sm ${paymentMethod === 'BANK' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPaymentMethod('BANK')}
                    style={{ flex: 1 }}
                  >
                    <Landmark size={12} /> Bank
                  </button>
                </div>
              </div>
              {paymentMethod === 'BANK' && (
                <div className="form-group">
                  <label className="form-label">Bank Account *</label>
                  <select id="po-bank" className="form-select" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                    <option value="">— Select Bank Account —</option>
                    {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountNumber}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Amount Paid Now (Rs)</label>
                <input
                  id="po-paid"
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input tabular"
                  style={{ fontSize: 18, fontWeight: 700, padding: '10px 12px' }}
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('save-po-btn')?.focus();
                    }
                  }}
                />
              </div>
              <div className="pos-total-row" style={{ padding: '4px 0' }}>
                <span className="text-muted text-sm">Balance Payable</span>
                <span className="tabular" style={{ fontWeight: 700, color: (totalAmount - paid) > 0 ? 'var(--alert)' : 'var(--paid)' }}>{pkr(Math.max(totalAmount - paid, 0))}</span>
              </div>
            </div>
            <div className="card card-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Narration</label>
                <textarea className="form-input" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Optional transaction note..." rows={2} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <button id="save-po-btn" className="btn btn-brand" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}
              disabled={saveMutation.isPending || items.length === 0 || !companyId || (paymentMethod === 'BANK' && paid > 0 && !bankAccountId)} onClick={handleSave}>
              {saveMutation.isPending ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Saving...</> : '💾 Save Purchase Order'}
            </button>
          </div>
        </div>
      ) : (
        /* History tab */
        <div>
          <div className="card">
            <div className="data-table-wrap" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO #</th>
                    <th>Company</th>
                    <th>Date</th>
                    <th className="num">Total</th>
                    <th className="num">Paid</th>
                    <th className="num">Balance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No purchase orders yet</td></tr>
                  ) : history.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.purchaseNo}</td>
                      <td>{p.company?.companyName}</td>
                      <td>{fmtDate(p.purchaseDate)}</td>
                      <td className="num tabular">{pkr(p.totalAmount)}</td>
                      <td className="num tabular">{pkr(p.paidAmount)}</td>
                      <td className="num tabular" style={{ color: parseFloat(p.balanceAmount) > 0 ? 'var(--alert)' : 'var(--paid)', fontWeight: 600 }}>{pkr(p.balanceAmount)}</td>
                      <td>{statusBadge(p.paymentStatus)}</td>
                      <td>
                        {p.paymentStatus !== 'PAID' && (
                          <button className="btn btn-sm btn-outline" onClick={() => setPayModal(p)}><DollarSign size={12} /> Pay</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payModal && (
        <PaymentModal
          title={`Record Payment — ${payModal.purchaseNo}`}
          balance={payModal.balanceAmount}
          bankAccounts={bankAccounts}
          onClose={() => setPayModal(null)}
          onSave={(amt, method, bankId) => payMutation.mutate({ id: payModal.id, amount: amt, paymentMethod: method, bankAccountId: bankId })}
          loading={payMutation.isPending}
        />
      )}
    </div>
  );
}

function PaymentModal({ title, balance, bankAccounts = [], onClose, onSave, loading }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [bankId, setBankId] = useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><span>{title}</span><button className="btn-icon" onClick={onClose}><X size={14} /></button></div>
        <div className="modal-body">
          <p className="text-muted" style={{ marginBottom: 12 }}>Balance Due: <strong style={{ color: 'var(--alert)' }}>Rs {parseFloat(balance).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</strong></p>
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`btn btn-sm ${method === 'CASH' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setMethod('CASH'); setBankId(''); }} style={{ flex: 1 }}>💵 Cash</button>
              <button className={`btn btn-sm ${method === 'BANK' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMethod('BANK')} style={{ flex: 1 }}>🏦 Bank</button>
            </div>
          </div>
          {method === 'BANK' && (
            <div className="form-group">
              <label className="form-label">Bank Account *</label>
              <select className="form-select" value={bankId} onChange={(e) => setBankId(e.target.value)}>
                <option value="">— Select —</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountNumber}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Amount to Pay (Rs)</label>
            <input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && amount && !loading && !(method === 'BANK' && !bankId)) {
                  e.preventDefault();
                  onSave(parseFloat(amount), method, bankId);
                }
              }}
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button id="confirm-pay-btn" className="btn btn-primary" disabled={loading || !amount || (method === 'BANK' && !bankId)} onClick={() => onSave(parseFloat(amount), method, bankId)}>
            {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
