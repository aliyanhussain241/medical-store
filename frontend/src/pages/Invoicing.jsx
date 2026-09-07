// ─────────────────────────────────────────────────────────────
// src/pages/Invoicing.jsx
// POS Sales Invoicing screen with:
//   - TP / Retail / Net Pricing Mode System
//   - Strict Retail Price Lock (read-only with lock indicator)
//   - Client Reference Invoice Format (PDF, Excel, On-Screen Modal, Print)
//   - Customer Previous Balance (Prv) & Area Tracking
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersAPI, productsAPI, invoicesAPI, exportAPI, offerListsAPI, downloadBlob, bankAccountsAPI } from '../api/services';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../utils/useDebounce';
import toast from 'react-hot-toast';
import { Search, Plus, Trash2, FileDown, Printer, Tag, Lock, Eye, X, CheckCircle, Landmark, Pencil, Key } from 'lucide-react';

function pkr(v) {
  return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDayName(d) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dt = d ? new Date(d) : new Date();
  return days[dt.getDay()];
}

function formatTime(d) {
  const dt = d ? new Date(d) : new Date();
  return dt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
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

export default function Invoicing() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Invoicing states
  const [customerId, setCustomerId] = useState('');
  const [salesman, setSalesman] = useState('');
  const [defaultPricingMode, setDefaultPricingMode] = useState('RETAIL'); // Item #2: Default to RETAIL
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceType, setInvoiceType] = useState('CREDIT'); // 'CREDIT' | 'CASH'
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [editingInvoiceNo, setEditingInvoiceNo] = useState(null);
  const [isPastEdit, setIsPastEdit] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordPromptModal, setPasswordPromptModal] = useState(null);
  const [promptInputPassword, setPromptInputPassword] = useState('');
  const [items, setItems] = useState([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH' | 'BANK'
  const [bankAccountId, setBankAccountId] = useState('');
  const [narration, setNarration] = useState('');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [highlightedProductIdx, setHighlightedProductIdx] = useState(0);

  // Invoice view / print modal
  const [savedInvoiceId, setSavedInvoiceId] = useState(null);
  const [savedInvoiceData, setSavedInvoiceData] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const debouncedProductSearch = useDebounce(productSearch, 300);

  // Reset highlighted search item when query changes
  useEffect(() => {
    setHighlightedProductIdx(0);
  }, [debouncedProductSearch]);

  const [pendingFocusItem, setPendingFocusItem] = useState(null);
  const [highlightRowIdx, setHighlightRowIdx] = useState(null);

  // Auto-focus and scroll to newly added item (Quantity or Manual Name)
  useEffect(() => {
    if (pendingFocusItem !== null) {
      const { idx, field } = pendingFocusItem;
      setPendingFocusItem(null);

      const timer = setTimeout(() => {
        let el = null;
        if (field === 'name') {
          el = document.getElementById(`manual-item-name-${idx}`) ||
               document.getElementById(`mobile-manual-item-name-${idx}`);
        } else {
          el = document.getElementById(`item-qty-${idx}`) ||
               document.getElementById(`mobile-item-qty-${idx}`);
        }

        if (el) {
          el.focus();
          if (typeof el.select === 'function') el.select();
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);

      setHighlightRowIdx(idx);
      const hlTimer = setTimeout(() => {
        setHighlightRowIdx(null);
      }, 2000);

      return () => {
        clearTimeout(hlTimer);
      };
    }
  }, [pendingFocusItem]);

  // Auto-focus customer on initial mount for rapid keyboard entry
  useEffect(() => {
    const custEl = document.getElementById('inv-customer');
    if (custEl) custEl.focus();
  }, []);

  // Customers dropdown
  const { data: custData } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersAPI.list({ limit: 500 }).then((r) => r.data.data),
  });
  const customers = custData || [];
  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Product search results (debounced)
  const { data: prodData } = useQuery({
    queryKey: ['products-search', debouncedProductSearch],
    queryFn: () => productsAPI.list({ search: debouncedProductSearch, limit: 20 }).then((r) => r.data.data),
    enabled: debouncedProductSearch.length > 0,
  });
  const products = prodData || [];

  // Active offers lookup map: { [productId]: offerDetails }
  const { data: activeOffers = {} } = useQuery({
    queryKey: ['active-offers'],
    queryFn: () => offerListsAPI.getActiveOffers().then((r) => r.data.data),
  });

  // Bank accounts dropdown
  const { data: bankData } = useQuery({
    queryKey: ['bank-accounts-all'],
    queryFn: () => bankAccountsAPI.list({ limit: 100 }).then((r) => r.data.data),
  });
  const bankAccounts = bankData || [];

  function addProduct(p) {
    if (items.find((i) => i.productId === p.id)) {
      toast('Product already in list — adjusting quantity in table.', { icon: 'ℹ️' });
      const existingIdx = items.findIndex((i) => i.productId === p.id);
      if (existingIdx !== -1) {
        setPendingFocusItem({ idx: existingIdx, field: 'qty' });
      }
      return;
    }
    if (parseFloat(p.stockQty) <= 0) {
      toast.error(`${p.productName} is out of stock.`);
      return;
    }

    const tradePrice = parseFloat(p.tradePrice || p.purchasePrice || 0);
    const retailPrice = parseFloat(p.salePrice || 0);
    const offer = activeOffers[p.id];

    let mode = defaultPricingMode;
    let unitPrice = mode === 'TP' ? tradePrice : retailPrice;
    let discount = 0;
    let schemeUnits = 0;

    if (offer) {
      if (offer.offerType === 'PERCENTAGE') {
        discount = parseFloat(offer.offerValue || 0);
        toast.success(`Applied ${offer.offerLabel} offer discount for ${p.productName}`);
      } else if (offer.offerType === 'NET') {
        mode = 'NET';
        unitPrice = parseFloat(offer.offerValue || unitPrice);
        discount = 0;
        toast.success(`Applied Net Price ${offer.offerLabel} for ${p.productName}`);
      } else if (offer.offerType === 'TP') {
        mode = 'TP';
        unitPrice = tradePrice;
        discount = 0;
      } else if (offer.offerType === 'BONUS') {
        toast(`🎁 Scheme: Buy ${offer.bonusBuyQty} get ${offer.bonusFreeQty} Free!`, { icon: '🎁' });
      }
    }

    const newIdx = items.length;
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.productName,
        unit: p.unit || 'strip',
        batchNo: p.batchNo || '',
        availableQty: parseFloat(p.stockQty),
        qty: 1,
        pricingMode: mode,
        tradePrice,
        retailPrice,
        unitPrice,
        discount,
        schemeUnits: 0,
        schemeTotal: 0,
        freePcs: 0,
        offer: offer || null,
      },
    ]);
    setProductSearch('');
    setPendingFocusItem({ idx: newIdx, field: 'qty' });
  }

  function handleModeChange(idx, newMode) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        let newPrice = item.unitPrice;
        if (newMode === 'TP') newPrice = item.tradePrice;
        else if (newMode === 'RETAIL') newPrice = item.retailPrice;
        return {
          ...item,
          pricingMode: newMode,
          unitPrice: newPrice,
        };
      })
    );
  }

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // Item #12: Manual Product Entry on Invoicing
  function addManualItem() {
    const newIdx = items.length;
    setItems((prev) => [
      ...prev,
      {
        productId: null,
        isManual: true,
        productName: '',
        unit: 'Pcs',
        batchNo: '',
        availableQty: 999999,
        qty: 1,
        pricingMode: defaultPricingMode,
        tradePrice: 0,
        retailPrice: 0,
        unitPrice: 0,
        discount: 0,
        schemeUnits: 0,
        schemeTotal: 0,
        freePcs: 0,
        offer: null,
      },
    ]);
    setPendingFocusItem({ idx: newIdx, field: 'name' });
  }

  // Line & grand total calculations
  const totalAmount = items.reduce((sum, item) => {
    const q = parseFloat(item.qty) || 0;
    const p = parseFloat(item.unitPrice) || 0;
    const d = parseFloat(item.discount) || 0;
    const gross = q * p;
    const discAmt = gross * (d / 100);
    return sum + (gross - discAmt);
  }, 0);

  const paid = parseFloat(paidAmount) || 0;
  const balance = totalAmount - paid;
  const prvBalance = parseFloat(selectedCustomer?.currentBalance || 0);
  const projectedBalance = prvBalance + balance;
  const paymentStatus = paid <= 0 ? 'PENDING' : paid >= totalAmount ? 'PAID' : 'PARTIAL';

  // Automatically keep paidAmount = totalAmount when Cash Invoice is chosen
  useEffect(() => {
    if (invoiceType === 'CASH') {
      setPaidAmount(totalAmount > 0 ? totalAmount.toFixed(2) : '');
    }
  }, [invoiceType, totalAmount]);

  function cancelEdit() {
    setEditingInvoiceId(null);
    setEditingInvoiceNo(null);
    setIsPastEdit(false);
    setAdminPassword('');
    setItems([]);
    setPaidAmount('');
    setPaymentMethod('CASH');
    setBankAccountId('');
    setNarration('');
    setNotes('');
    setInvoiceType('CREDIT');
  }

  function handleEditInvoice(inv, password = '') {
    const todayStr = new Date().toISOString().slice(0, 10);
    const invDateStr = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '';
    const isPast = invDateStr !== todayStr;

    if (isPast && !password) {
      setPromptInputPassword('');
      setPasswordPromptModal(inv);
      return;
    }

    setIsPastEdit(isPast);
    setAdminPassword(password);
    setEditingInvoiceId(inv.id);
    setEditingInvoiceNo(inv.invoiceNo);
    setCustomerId(inv.customerId || '');
    setSalesman(inv.salesman || '');
    setInvoiceDate(inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setInvoiceType(inv.invoiceType || (parseFloat(inv.paidAmount) >= parseFloat(inv.totalAmount) ? 'CASH' : 'CREDIT'));
    setPaidAmount(inv.paidAmount ? inv.paidAmount.toString() : '');
    setPaymentMethod(inv.paymentMethod || 'CASH');
    setBankAccountId(inv.bankAccountId || '');
    setNarration(inv.narration || '');
    setNotes(inv.notes || '');

    if (inv.items && inv.items.length > 0) {
      setItems(
        inv.items.map((it) => {
          const prod = it.product || {};
          const isManual = !it.productId || !!it.customName;
          return {
            productId: it.productId || null,
            isManual,
            productName: it.customName || prod.productName || 'Manual Item',
            unit: it.packing || prod.unit || 'Pack',
            batchNo: it.batchNo || prod.batchNo || '',
            availableQty: isManual ? 999999 : ((parseFloat(prod.stockQty) || 0) + (parseFloat(it.qty) || 0)),
            tradePrice: parseFloat(prod.tradePrice || prod.purchasePrice || it.unitPrice || 0),
            retailPrice: parseFloat(prod.salePrice || it.unitPrice || 0),
            unitPrice: parseFloat(it.unitPrice || 0),
            pricingMode: it.pricingMode || 'RETAIL',
            qty: it.qty,
            discount: it.discount || 0,
            schemeUnits: it.schemeUnits || 0,
            schemeTotal: it.schemeTotal || 0,
            freePcs: it.freePcs || 0,
          };
        })
      );
    }
    if (isPast) {
      toast(`Loaded past invoice ${inv.invoiceNo} for editing (Authorized).`, { icon: '🔓' });
    } else {
      toast(`Loaded invoice ${inv.invoiceNo} for same-day editing.`, { icon: '✏️' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const saveMutation = useMutation({
    mutationFn: (data) => invoicesAPI.create(data),
    onSuccess: (res) => {
      const inv = res.data.data;
      toast.success(`Invoice ${inv.invoiceNo} saved!`);
      setSavedInvoiceId(inv.id);
      setSavedInvoiceData(inv);
      setPreviewModalOpen(true);
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['dashboard']);
      qc.invalidateQueries(['customers']);
      qc.invalidateQueries(['invoices-recent']);
      // Auto-trigger print dialog for cashier convenience
      setTimeout(() => {
        window.print();
      }, 400);
      // Reset form
      setItems([]);
      setPaidAmount('');
      setPaymentMethod('CASH');
      setBankAccountId('');
      setNarration('');
      setNotes('');
      setInvoiceType('CREDIT');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error saving invoice.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => invoicesAPI.update(id, data),
    onSuccess: (res) => {
      const inv = res.data.data;
      toast.success(`Invoice ${inv.invoiceNo} updated successfully!`);
      setSavedInvoiceId(inv.id);
      setSavedInvoiceData(inv);
      setPreviewModalOpen(true);
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['dashboard']);
      qc.invalidateQueries(['customers']);
      qc.invalidateQueries(['invoices-recent']);
      cancelEdit();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error updating invoice.'),
  });

  function handleSave() {
    if (!customerId) {
      toast.error('Please select a customer.');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one product.');
      return;
    }
    for (const item of items) {
      if (item.productId && !item.isManual) {
        const totalReq = parseFloat(item.qty || 0) + parseFloat(item.schemeUnits || 0) + parseFloat(item.freePcs || 0);
        if (totalReq > item.availableQty) {
          toast.error(`Quantity for "${item.productName}" exceeds available stock (${item.availableQty}).`);
          return;
        }
      }
    }

    if (paymentMethod === 'BANK' && paid > 0 && !bankAccountId) {
      toast.error('Please select a bank account.');
      return;
    }

    const payload = {
      customerId,
      invoiceDate,
      invoiceType,
      paidAmount: paid,
      paymentMethod,
      bankAccountId: paymentMethod === 'BANK' ? bankAccountId : undefined,
      narration: narration.trim() || undefined,
      salesman: salesman.trim() || undefined,
      notes: notes.trim() || undefined,
      ...(isPastEdit && adminPassword ? { adminPassword } : {}),
      items: items.map((i) => {
        const gross = (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0);
        const discAmt = gross * ((parseFloat(i.discount) || 0) / 100);
        return {
          productId: i.productId || null,
          customName: !i.productId || i.isManual ? (i.productName || 'Manual Item') : undefined,
          qty: parseFloat(i.qty),
          unitPrice: parseFloat(i.unitPrice),
          pricingMode: i.pricingMode || 'RETAIL',
          batchNo: i.batchNo || undefined,
          packing: i.unit || undefined,
          discount: parseFloat(i.discount) || 0,
          discountAmt: discAmt,
          schemeUnits: parseFloat(i.schemeUnits) || 0,
          schemeTotal: parseFloat(i.schemeTotal) || 0,
          freePcs: parseFloat(i.freePcs) || 0,
          grossTotal: gross,
        };
      }),
    };

    if (editingInvoiceId) {
      updateMutation.mutate({ id: editingInvoiceId, data: payload });
    } else {
      saveMutation.mutate(payload);
    }
  }

  async function handleExport(type) {
    if (!savedInvoiceId) {
      toast.error('Save the invoice first before exporting.');
      return;
    }
    try {
      const res =
        type === 'pdf'
          ? await exportAPI.invoicePDF(savedInvoiceId)
          : await exportAPI.invoiceExcel(savedInvoiceId);
      downloadBlob(res, `Invoice-${savedInvoiceData?.invoiceNo || 'Doc'}.${type === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast.success(`${type.toUpperCase()} downloaded.`);
    } catch {
      toast.error('Export failed.');
    }
  }

  async function handlePrintInvoice() {
    if (savedInvoiceId) {
      try {
        await invoicesAPI.markPrinted(savedInvoiceId);
        if (savedInvoiceData) {
          setSavedInvoiceData({ ...savedInvoiceData, printCount: (savedInvoiceData.printCount || 0) + 1 });
        }
      } catch (e) {
        // ignore
      }
    }
    window.print();
  }

  // Keyboard shortcuts for power cashiers: F2 to search, Ctrl+Enter to save
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        const searchEl = document.getElementById('prod-search-inv');
        if (searchEl) searchEl.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [customerId, items, paidAmount, salesman, notes, invoiceDate]);

  return (
    <div className="invoicing-page">
      <div className="page-header">
        <h2 className="page-title">New Sales Invoice</h2>
        {savedInvoiceId && (
          <div className="flex gap-8">
            <button
              id="view-invoice-modal-btn"
              className="btn btn-primary btn-sm"
              onClick={() => setPreviewModalOpen(true)}
            >
              <Eye size={13} /> View / Print Invoice
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => handleExport('pdf')}>
              <FileDown size={13} /> Export PDF
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => handleExport('excel')}>
              <FileDown size={13} /> Export Excel
            </button>
          </div>
        )}
      </div>

      <div className="pos-layout">
        {/* LEFT — Product search + line items */}
        <div className="pos-left">
          {/* Invoice meta & Customer Selection */}
          <div className="card">
            <div className="card-body">
              {/* Editing Status Banner if active */}
              {editingInvoiceId && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    background: isPastEdit ? '#fef3c7' : '#e0e7ff',
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: isPastEdit ? '1px solid #f59e0b' : '1px solid #6366f1',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: isPastEdit ? '#92400e' : '#3730a3' }}>
                    {isPastEdit ? '🔓 Editing Past Invoice' : '✏️ Editing Invoice'} #{editingInvoiceNo} ({fmtDate(invoiceDate)}) {isPastEdit ? '— Authorized' : '(Same-Day)'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={cancelEdit}
                    style={{ padding: '2px 8px', fontSize: 11 }}
                  >
                    Cancel Edit
                  </button>
                </div>
              )}

              {/* STEP 1: Select Customer */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 0 }}>
                    1. Select Customer *
                  </label>
                  {selectedCustomer && (
                    <div style={{ fontSize: 12, display: 'flex', gap: 12 }}>
                      <span>Code: <strong>{selectedCustomer.customerCode || '0'}</strong></span>
                      <span>Area: <strong>{selectedCustomer.area || 'UNASSIGNED'}</strong></span>
                      <span>
                        Prv Bal:{' '}
                        <strong style={{ color: prvBalance > 0 ? 'var(--alert)' : 'var(--paid)' }}>
                          {pkr(prvBalance)} {prvBalance > 0 ? '(Due)' : '(Clear)'}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
                <select
                  id="inv-customer"
                  className="form-select"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('inv-type-credit-btn')?.focus();
                    }
                  }}
                >
                  <option value="">— Select Customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customerCode ? `[${c.customerCode}] ` : ''}
                      {c.customerName}
                      {c.area ? ` — ${c.area}` : ''}
                      {c.shopName ? ` (${c.shopName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* STEP 2: Invoice Type (Cash / Credit) & Meta Details */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)' }}>
                    2. Payment Mode:
                  </span>
                  <div
                    style={{
                      display: 'inline-flex',
                      background: 'var(--bg-muted, #f1f5f9)',
                      borderRadius: 6,
                      padding: 2,
                    }}
                  >
                    <button
                      type="button"
                      id="inv-type-credit-btn"
                      className={`btn-pill ${invoiceType === 'CREDIT' ? 'active' : ''}`}
                      onClick={() => {
                        setInvoiceType('CREDIT');
                        setPaidAmount('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          document.getElementById('inv-salesman')?.focus();
                        } else if (e.key === 'ArrowRight') {
                          e.preventDefault();
                          setInvoiceType('CASH');
                          document.getElementById('inv-type-cash-btn')?.focus();
                        }
                      }}
                      style={{
                        padding: '4px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        background: invoiceType === 'CREDIT' ? 'var(--primary, #2563eb)' : 'transparent',
                        color: invoiceType === 'CREDIT' ? '#fff' : 'var(--text-secondary, #475569)',
                      }}
                    >
                      Credit Invoice (Default)
                    </button>
                    <button
                      type="button"
                      id="inv-type-cash-btn"
                      className={`btn-pill ${invoiceType === 'CASH' ? 'active' : ''}`}
                      onClick={() => {
                        setInvoiceType('CASH');
                        setPaidAmount(totalAmount > 0 ? totalAmount.toFixed(2) : '');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          document.getElementById('inv-salesman')?.focus();
                        } else if (e.key === 'ArrowLeft') {
                          e.preventDefault();
                          setInvoiceType('CREDIT');
                          document.getElementById('inv-type-credit-btn')?.focus();
                        }
                      }}
                      style={{
                        padding: '4px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        background: invoiceType === 'CASH' ? '#166534' : 'transparent',
                        color: invoiceType === 'CASH' ? '#fff' : 'var(--text-secondary, #475569)',
                      }}
                    >
                      Cash Invoice
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label className="form-label" style={{ fontSize: 11, marginBottom: 0 }}>Salesman:</label>
                    <input
                      id="inv-salesman"
                      className="form-input"
                      placeholder="e.g. Ali Khan"
                      style={{ width: 120, padding: '4px 8px', fontSize: 12 }}
                      value={salesman}
                      onChange={(e) => setSalesman(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          document.getElementById('prod-search-inv')?.focus();
                        }
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label className="form-label" style={{ fontSize: 11, marginBottom: 0 }}>Date:</label>
                    <input
                      id="inv-date"
                      type="date"
                      className="form-input"
                      style={{ width: 130, padding: '4px 6px', fontSize: 12 }}
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          document.getElementById('prod-search-inv')?.focus();
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Default Pricing Mode Selector for POS Workflow */}
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px dashed var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Default Line Pricing:
                  </span>
                  <div
                    className="pricing-mode-pills"
                    style={{
                      display: 'inline-flex',
                      background: 'var(--bg-muted, #f1f5f9)',
                      borderRadius: 6,
                      padding: 2,
                    }}
                  >
                    <button
                      type="button"
                      id="default-mode-retail-btn"
                      className={`btn-pill ${defaultPricingMode === 'RETAIL' ? 'active' : ''}`}
                      onClick={() => setDefaultPricingMode('RETAIL')}
                      style={{
                        padding: '3px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        background: defaultPricingMode === 'RETAIL' ? '#166534' : 'transparent',
                        color: defaultPricingMode === 'RETAIL' ? '#fff' : 'var(--text-secondary, #475569)',
                      }}
                    >
                      Retail (MRP) — Default
                    </button>
                    <button
                      type="button"
                      id="default-mode-tp-btn"
                      className={`btn-pill ${defaultPricingMode === 'TP' ? 'active' : ''}`}
                      onClick={() => setDefaultPricingMode('TP')}
                      style={{
                        padding: '3px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        background: defaultPricingMode === 'TP' ? 'var(--primary, #2563eb)' : 'transparent',
                        color: defaultPricingMode === 'TP' ? '#fff' : 'var(--text-secondary, #475569)',
                      }}
                    >
                      TP (Trade Price)
                    </button>
                  </div>
                  <span className="text-muted text-xs">New line items will default to Retail</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product search */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700 }}>3. Add Products</span>
                <button
                  type="button"
                  id="add-manual-item-btn"
                  className="btn btn-outline btn-sm"
                  onClick={addManualItem}
                  style={{ padding: '2px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563eb' }}
                  title="Add a custom/one-off product not in catalog"
                >
                  <Plus size={12} /> + Manual Item
                </button>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: '#F1F5F2',
                  border: '1px solid var(--border)',
                  padding: '2px 7px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                Press <kbd style={{ fontWeight: 700, color: 'var(--text)' }}>F2</kbd> to search
              </span>
            </div>
            <div className="card-body" style={{ paddingBottom: 0 }}>
              <div className="search-input-wrap" style={{ maxWidth: '100%', marginBottom: 10 }}>
                <Search size={14} />
                <input
                  id="prod-search-inv"
                  placeholder="Search product by name... (Press Enter to pick, or on empty to pay)"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (products.length > 0) {
                        setHighlightedProductIdx((prev) => (prev + 1) % products.length);
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (products.length > 0) {
                        setHighlightedProductIdx((prev) => (prev - 1 + products.length) % products.length);
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (products.length > 0 && productSearch.trim().length > 0) {
                        const chosen = products[highlightedProductIdx] || products[0];
                        if (chosen) {
                          addProduct(chosen);
                        }
                      } else if (!productSearch.trim() && items.length > 0) {
                        // Empty search + Enter -> go to Paid Amount or Save
                        const paidInput = document.getElementById('inv-paid');
                        if (paidInput && invoiceType !== 'CASH') {
                          paidInput.focus();
                          paidInput.select();
                        } else {
                          document.getElementById('save-invoice-btn')?.focus();
                        }
                      }
                    }
                  }}
                />
              </div>
              {products.length > 0 && productSearch && (
                <div
                  id="prod-results-container"
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    maxHeight: 220,
                    overflowY: 'auto',
                    marginBottom: 10,
                  }}
                >
                  {products.map((p, pIdx) => {
                    const isSelected = pIdx === highlightedProductIdx;
                    const tp = parseFloat(p.tradePrice || p.purchasePrice || 0);
                    const rp = parseFloat(p.salePrice || 0);
                    return (
                      <div
                        key={p.id}
                        id={`prod-result-${pIdx}`}
                        style={{
                          padding: '10px 12px',
                          minHeight: 44,
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 13,
                          background: isSelected ? 'rgba(37, 99, 235, 0.09)' : undefined,
                          borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                          transition: 'background 100ms ease',
                        }}
                        onClick={() => addProduct(p)}
                        onMouseEnter={() => setHighlightedProductIdx(pIdx)}
                      >
                        <div>
                          <span style={{ fontWeight: isSelected ? 700 : 600 }}>{p.productName}</span>
                          <span className="text-muted" style={{ marginLeft: 8 }}>
                            {p.category}
                          </span>
                          {activeOffers[p.id] && (
                            <span
                              className={`badge ${getOfferBadgeClass(activeOffers[p.id].offerType)}`}
                              style={{ marginLeft: 8, fontSize: 10, textTransform: 'none' }}
                            >
                              Offer: {activeOffers[p.id].offerLabel}
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12 }}>
                          <div
                            style={{
                              color:
                                parseFloat(p.stockQty) <= parseFloat(p.minStockAlert)
                                  ? 'var(--alert)'
                                  : 'var(--brand)',
                              fontWeight: 600,
                            }}
                          >
                            Stock: {parseFloat(p.stockQty)} {p.unit}
                          </div>
                          <div className="text-muted">
                            <span style={{ color: '#2563eb', fontWeight: 600 }}>TP: {pkr(tp)}</span>
                            <span style={{ marginLeft: 8 }}>Retail: {pkr(rp)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Line items — with Pricing Mode, Retail Price Lock & Reference Fields */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header flex justify-between items-center">
              <span>
                Line Items <span className="text-muted text-sm">({items.length} items)</span>
              </span>
              <span className="text-xs text-muted">
                Retail price locked • Net mode editable for custom rates
              </span>
            </div>

            {/* Desktop table */}
            <div
              className="data-table-wrap"
              style={{ border: 'none', display: 'var(--inv-table-display, block)' }}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product & Packing</th>
                    <th style={{ width: 105 }}>Mode</th>
                    <th className="num" style={{ width: 65 }}>
                      Qty
                    </th>
                    <th className="num" style={{ width: 110 }}>
                      Unit Price
                    </th>
                    <th className="num" style={{ width: 75 }}>
                      Gross
                    </th>
                    <th className="num" style={{ width: 65 }}>
                      Disc %
                    </th>
                    <th className="num" style={{ width: 55 }}>
                      ST/U
                    </th>
                    <th className="num" style={{ width: 55 }}>
                      Free Pcs
                    </th>
                    <th className="num" style={{ width: 85 }}>
                      Net Total
                    </th>
                    <th style={{ width: 35 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}
                      >
                        Search and add products above
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const qty = parseFloat(item.qty) || 0;
                      const price = parseFloat(item.unitPrice) || 0;
                      const gross = qty * price;
                      const discAmt = gross * ((parseFloat(item.discount) || 0) / 100);
                      const net = gross - discAmt;

                      return (
                        <tr
                          key={item.productId || `manual-${idx}`}
                          style={{
                            background:
                              !item.isManual && qty > item.availableQty
                                ? '#FFF9F9'
                                : highlightRowIdx === idx
                                ? '#ECFDF5'
                                : undefined,
                            transition: 'background 250ms ease',
                          }}
                        >
                          <td style={{ fontWeight: 500 }}>
                            {item.isManual || !item.productId ? (
                              <div>
                                <input
                                  id={`manual-item-name-${idx}`}
                                  type="text"
                                  className="form-input manual-item-input"
                                  style={{ padding: '3px 6px', fontSize: 12, fontWeight: 600, width: '100%', marginBottom: 3 }}
                                  placeholder="Enter custom item name..."
                                  value={item.productName}
                                  onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const qtyEl = document.getElementById(`item-qty-${idx}`) || document.getElementById(`mobile-item-qty-${idx}`);
                                      if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
                                    }
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <span className="badge" style={{ fontSize: 9, padding: '1px 5px', background: '#e0e7ff', color: '#3730a3' }}>Manual Item</span>
                                  <input
                                    type="text"
                                    className="form-input"
                                    style={{ width: 60, padding: '1px 4px', fontSize: 10 }}
                                    placeholder="Unit (Pcs)"
                                    value={item.unit}
                                    onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{ fontWeight: 600 }}>{item.productName}</div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    flexWrap: 'wrap',
                                    marginTop: 2,
                                    fontSize: 11,
                                  }}
                                >
                                  <span className="text-muted">{item.unit}</span>
                                  {item.batchNo && (
                                    <span className="text-muted">Batch: {item.batchNo}</span>
                                  )}
                                  <span className="text-muted">Avail: {item.availableQty}</span>
                                  {item.offer && (
                                    <span
                                      className={`badge ${getOfferBadgeClass(item.offer.offerType)}`}
                                      style={{ fontSize: 9, padding: '1px 5px', textTransform: 'none' }}
                                    >
                                      {item.offer.offerLabel}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </td>

                          {/* Pricing Mode Selector: TP | Retail | Net */}
                          <td>
                            <select
                              id={`item-mode-${idx}`}
                              className="form-select"
                              style={{
                                padding: '3px 6px',
                                fontSize: 11,
                                fontWeight: 600,
                                width: 95,
                                color:
                                  item.pricingMode === 'TP'
                                    ? '#1e40af'
                                    : item.pricingMode === 'RETAIL'
                                    ? '#166534'
                                    : '#b45309',
                                background:
                                  item.pricingMode === 'TP'
                                    ? 'rgba(37,99,235,0.06)'
                                    : item.pricingMode === 'RETAIL'
                                    ? 'rgba(22,101,52,0.06)'
                                    : 'rgba(217,119,6,0.06)',
                              }}
                              value={item.pricingMode}
                              onChange={(e) => handleModeChange(idx, e.target.value)}
                            >
                              <option value="RETAIL">Retail (MRP)</option>
                              <option value="TP">TP (Trade)</option>
                              <option value="NET">Net (Custom)</option>
                            </select>
                          </td>

                          {/* Quantity (PKT) — Prominent with auto-select & clear focus halo */}
                          <td className="num">
                            <input
                              id={`item-qty-${idx}`}
                              type="number"
                              min="0.001"
                              step="0.001"
                              className={`form-input tabular item-qty-input ${idx === items.length - 1 ? 'item-qty-input-last' : ''}`}
                              style={{
                                width: 72,
                                padding: '4px 6px',
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: 13,
                                borderColor: highlightRowIdx === idx ? 'var(--brand)' : undefined,
                                boxShadow: highlightRowIdx === idx ? '0 0 0 3.5px rgba(15, 110, 79, 0.22)' : undefined,
                              }}
                              value={item.qty}
                              onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (item.isManual || item.pricingMode === 'NET') {
                                    const priceEl = document.getElementById(`item-price-${idx}`);
                                    if (priceEl) { priceEl.focus(); priceEl.select(); return; }
                                  }
                                  const discEl = document.getElementById(`item-disc-${idx}`);
                                  if (discEl) {
                                    discEl.focus();
                                    discEl.select();
                                  } else {
                                    const searchEl = document.getElementById('prod-search-inv');
                                    if (searchEl) { searchEl.focus(); searchEl.select(); }
                                  }
                                }
                              }}
                            />
                          </td>

                          {/* Unit Price — LOCKED in Retail & TP for catalog items, EDITABLE in Net or Manual */}
                          <td className="num">
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 4,
                              }}
                            >
                              {!item.isManual && item.pricingMode === 'RETAIL' && (
                                <span
                                  title="Retail price is locked for catalog products. Use Net mode or manual item for custom rates."
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    color: '#64748b',
                                  }}
                                >
                                  <Lock size={12} id={`lock-icon-${idx}`} />
                                </span>
                              )}
                              <input
                                id={`item-price-${idx}`}
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-input tabular"
                                style={{
                                  width: 78,
                                  padding: '4px 6px',
                                  textAlign: 'right',
                                  background:
                                    item.isManual
                                      ? '#ffffff'
                                      : item.pricingMode === 'RETAIL'
                                      ? '#f1f5f9'
                                      : item.pricingMode === 'TP'
                                      ? '#f8fafc'
                                      : '#ffffff',
                                  cursor: !item.isManual && item.pricingMode === 'RETAIL' ? 'not-allowed' : 'text',
                                  borderColor:
                                    item.isManual || item.pricingMode === 'NET'
                                      ? 'var(--primary, #2563eb)'
                                      : undefined,
                                  fontWeight: item.isManual || item.pricingMode === 'NET' ? 700 : 500,
                                }}
                                value={item.unitPrice}
                                readOnly={!item.isManual && (item.pricingMode === 'RETAIL' || item.pricingMode === 'TP')}
                                onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const discEl = document.getElementById(`item-disc-${idx}`);
                                    if (discEl) {
                                      discEl.focus();
                                      discEl.select();
                                    } else {
                                      const searchEl = document.getElementById('prod-search-inv');
                                      if (searchEl) { searchEl.focus(); searchEl.select(); }
                                    }
                                  }
                                }}
                                title={
                                  item.isManual
                                    ? 'Custom item rate.'
                                    : item.pricingMode === 'RETAIL'
                                    ? 'Retail price is locked during invoicing. Use Net mode for custom rates.'
                                    : item.pricingMode === 'TP'
                                    ? 'Trade Price pulled from product master.'
                                    : 'Net Custom Rate for this invoice only.'
                                }
                              />
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color:
                                    item.isManual
                                      ? '#4f46e5'
                                      : item.pricingMode === 'TP'
                                      ? '#2563eb'
                                      : item.pricingMode === 'RETAIL'
                                      ? '#166534'
                                      : '#d97706',
                                }}
                              >
                                {item.isManual ? 'M' : item.pricingMode === 'TP' ? 'T' : item.pricingMode === 'RETAIL' ? 'R' : 'N'}
                              </span>
                            </div>
                          </td>

                          {/* Gross (Pre-discount) */}
                          <td className="num tabular text-muted text-sm">
                            {gross.toFixed(0)}
                          </td>

                          {/* Discount % */}
                          <td className="num">
                            <input
                              id={`item-disc-${idx}`}
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              className="form-input tabular"
                              style={{ width: 60, padding: '4px 6px', textAlign: 'center' }}
                              value={item.discount}
                              onChange={(e) => updateItem(idx, 'discount', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const searchEl = document.getElementById('prod-search-inv');
                                  if (searchEl) {
                                    searchEl.focus();
                                    searchEl.select();
                                  }
                                }
                              }}
                            />
                          </td>

                          {/* Scheme/Bonus Units (ST/U) */}
                          <td className="num">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="form-input tabular"
                              style={{ width: 45, padding: '4px 6px', textAlign: 'center' }}
                              value={item.schemeUnits || ''}
                              placeholder="0"
                              onChange={(e) => updateItem(idx, 'schemeUnits', e.target.value)}
                            />
                          </td>

                          {/* Free Pieces (PCS) */}
                          <td className="num">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="form-input tabular"
                              style={{ width: 45, padding: '4px 6px', textAlign: 'center' }}
                              value={item.freePcs || ''}
                              placeholder="0"
                              onChange={(e) => updateItem(idx, 'freePcs', e.target.value)}
                            />
                          </td>

                          {/* Net Total */}
                          <td className="num tabular" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {pkr(net)}
                          </td>

                          <td>
                            <button
                              className="btn-icon"
                              onClick={() => removeItem(idx)}
                              style={{ color: 'var(--alert)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile items view — Complete with Quantity, Modes, Price, and Discounts */}
            {items.length > 0 && (
              <div className="inv-mobile-items">
                {items.map((item, idx) => {
                  const qty = parseFloat(item.qty) || 0;
                  const price = parseFloat(item.unitPrice) || 0;
                  const gross = qty * price;
                  const discAmt = gross * ((parseFloat(item.discount) || 0) / 100);
                  const net = gross - discAmt;
                  const isHighlighted = highlightRowIdx === idx;

                  return (
                    <div
                      key={item.productId || `manual-mobile-${idx}`}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border)',
                        background: isHighlighted ? '#F0FDF4' : '#FFFFFF',
                        borderRadius: 8,
                        margin: '8px 4px',
                        boxShadow: isHighlighted ? '0 0 0 2px var(--brand)' : 'var(--shadow-xs)',
                        transition: 'background 250ms ease, box-shadow 250ms ease',
                      }}
                    >
                      {/* Header: Product Name & Delete */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          {item.isManual ? (
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>Manual Item Name *</label>
                              <input
                                id={`mobile-manual-item-name-${idx}`}
                                type="text"
                                className="form-input"
                                placeholder="Enter custom item name..."
                                value={item.productName}
                                onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const qtyEl = document.getElementById(`mobile-item-qty-${idx}`);
                                    if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
                                  }
                                }}
                                style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}
                              />
                            </div>
                          ) : (
                            <>
                              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>{item.productName}</div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <span>Unit: {item.unit}</span>
                                {item.batchNo && <span>• Batch: {item.batchNo}</span>}
                                <span>• Stock: {item.availableQty}</span>
                                {item.offer && (
                                  <span className={`badge ${getOfferBadgeClass(item.offer.offerType)}`} style={{ fontSize: 10 }}>
                                    {item.offer.offerLabel}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeItem(idx)}
                          style={{ color: 'var(--alert)', padding: 6 }}
                          title="Remove Item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Row 1: Quantity & Pricing Mode */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, marginTop: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', display: 'flex', justifyContent: 'space-between' }}>
                            <span>QUANTITY *</span>
                            <span style={{ fontSize: 10, color: '#64748B', fontWeight: 500 }}>({item.unit})</span>
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ minWidth: 32, height: 36, padding: 0, fontWeight: 700, fontSize: 16 }}
                              onClick={() => {
                                const cur = parseFloat(item.qty) || 1;
                                if (cur > 1) updateItem(idx, 'qty', cur - 1);
                              }}
                            >
                              −
                            </button>
                            <input
                              id={`mobile-item-qty-${idx}`}
                              type="number"
                              min="0.001"
                              step="0.001"
                              className="form-input tabular"
                              style={{
                                height: 36,
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: 14,
                                borderColor: isHighlighted ? 'var(--brand)' : undefined,
                                boxShadow: isHighlighted ? '0 0 0 3px rgba(15, 110, 79, 0.2)' : undefined,
                              }}
                              value={item.qty}
                              onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (item.isManual || item.pricingMode === 'NET') {
                                    const pEl = document.getElementById(`mobile-item-price-${idx}`);
                                    if (pEl) { pEl.focus(); pEl.select(); return; }
                                  }
                                  const dEl = document.getElementById(`mobile-item-disc-${idx}`);
                                  if (dEl) { dEl.focus(); dEl.select(); }
                                  else { document.getElementById('prod-search-inv')?.focus(); }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ minWidth: 32, height: 36, padding: 0, fontWeight: 700, fontSize: 16 }}
                              onClick={() => {
                                const cur = parseFloat(item.qty) || 0;
                                updateItem(idx, 'qty', cur + 1);
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#1E293B' }}>PRICING MODE</label>
                          <select
                            className="form-select"
                            style={{ height: 36, fontSize: 12, marginTop: 3, fontWeight: 600 }}
                            value={item.pricingMode}
                            onChange={(e) => handleModeChange(idx, e.target.value)}
                          >
                            <option value="RETAIL">Retail (MRP)</option>
                            <option value="TP">TP (Trade)</option>
                            <option value="NET">Net (Custom)</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Unit Price & Discount */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
                            Unit Price {item.pricingMode === 'RETAIL' && '🔒 (Locked)'}
                          </label>
                          <input
                            id={`mobile-item-price-${idx}`}
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            style={{
                              height: 36,
                              fontSize: 13,
                              marginTop: 3,
                              background: (!item.isManual && item.pricingMode === 'RETAIL') ? '#F1F5F9' : '#FFFFFF',
                            }}
                            value={item.unitPrice}
                            readOnly={!item.isManual && (item.pricingMode === 'RETAIL' || item.pricingMode === 'TP')}
                            onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const dEl = document.getElementById(`mobile-item-disc-${idx}`);
                                if (dEl) { dEl.focus(); dEl.select(); }
                                else { document.getElementById('prod-search-inv')?.focus(); }
                              }
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Discount %</label>
                          <input
                            id={`mobile-item-disc-${idx}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            className="form-input"
                            style={{ height: 36, fontSize: 13, marginTop: 3, textAlign: 'center' }}
                            value={item.discount}
                            onChange={(e) => updateItem(idx, 'discount', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                document.getElementById('prod-search-inv')?.focus();
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Row 3: Subtotal / Net Total */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: '1px dashed var(--border)',
                        fontSize: 12
                      }}>
                        <span style={{ color: '#64748B' }}>
                          {qty} × {pkr(price)} {item.discount > 0 && `(-${item.discount}%)`}
                        </span>
                        <span style={{ fontWeight: 800, color: 'var(--brand)', fontSize: 13.5 }}>
                          Net: {pkr(net)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Totals summary, Balance tracking & save button */}
        <div className="pos-right">
          {/* Invoice Summary Card */}
          <div className="card card-body">
            <div
              style={{
                fontWeight: 700,
                marginBottom: 10,
                fontSize: 13,
                color: 'var(--brand)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Invoice Summary
            </div>
            <div className="pos-total-row">
              <span>Gross Total</span>
              <span className="tabular">
                {pkr(
                  items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0)
                )}
              </span>
            </div>
            <div className="pos-total-row">
              <span>Total Discount</span>
              <span className="tabular text-muted">
                {pkr(
                  items.reduce((s, i) => {
                    const gross = (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0);
                    return s + gross * ((parseFloat(i.discount) || 0) / 100);
                  }, 0)
                )}
              </span>
            </div>
            <div className="pos-total-row grand">
              <span>Inv Total</span>
              <span className="tabular">{pkr(totalAmount)}</span>
            </div>
          </div>

          {/* Customer Running Balance Preview Card */}
          <div className="card card-body">
            <div
              style={{
                fontWeight: 700,
                marginBottom: 10,
                fontSize: 13,
                color: '#1e40af',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Party Balance Breakdown
            </div>

            <div className="pos-total-row" style={{ padding: '3px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Previous Balance (Prv)</span>
              <span
                className="tabular"
                style={{
                  fontWeight: 600,
                  color: prvBalance > 0 ? 'var(--alert)' : 'var(--paid)',
                }}
              >
                {pkr(prvBalance)}
              </span>
            </div>

            <div className="pos-total-row" style={{ padding: '3px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>+ This Invoice (Net)</span>
              <span className="tabular" style={{ fontWeight: 600 }}>
                {pkr(totalAmount)}
              </span>
            </div>

            {/* Payment Method Toggle */}
            <div className="form-group" style={{ marginTop: 8, marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Payment Method</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  id="inv-pay-cash"
                  className={`btn btn-sm ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { setPaymentMethod('CASH'); setBankAccountId(''); }}
                  style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  id="inv-pay-bank"
                  className={`btn btn-sm ${paymentMethod === 'BANK' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPaymentMethod('BANK')}
                  style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                >
                  <Landmark size={12} /> Bank
                </button>
              </div>
            </div>

            {paymentMethod === 'BANK' && (
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Bank Account *</label>
                <select
                  id="inv-bank"
                  className="form-select"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  style={{ fontSize: 12 }}
                >
                  <option value="">— Select Bank Account —</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.bankName} — {a.accountNumber}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: 12 }}>
                Amount Received ({paymentMethod === 'BANK' ? 'Bank' : 'Cash'})
              </label>
              <input
                id="inv-paid"
                type="number"
                step="0.01"
                min="0"
                className="form-input tabular"
                style={{ fontSize: 16, fontWeight: 700, padding: '8px 10px' }}
                placeholder="0.00"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('save-invoice-btn')?.focus();
                  }
                }}
              />
            </div>

            <div
              className="pos-total-row"
              style={{
                paddingTop: 8,
                borderTop: '1px solid var(--border)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <span>Projected Balance</span>
              <span
                className="tabular"
                style={{
                  color: projectedBalance > 0 ? 'var(--alert)' : 'var(--paid)',
                  fontSize: 15,
                }}
              >
                {pkr(projectedBalance)}
              </span>
            </div>

            <div className="form-group" style={{ marginTop: 10, marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: 11 }}>
                Narration (Accounting Note)
              </label>
              <textarea
                id="inv-narration"
                className="form-input"
                rows={2}
                placeholder="e.g. Bank slip # / Cheque # / Online ref..."
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                style={{ resize: 'vertical', fontSize: 12 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>
                Invoice Note (Optional)
              </label>
              <input
                id="inv-notes"
                className="form-input"
                placeholder="e.g. Urgent Delivery / Special discount"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Action Button */}
          <button
            id="save-invoice-btn"
            className="btn btn-brand pos-save-sticky"
            disabled={saveMutation.isPending || items.length === 0 || !customerId || (paymentMethod === 'BANK' && paid > 0 && !bankAccountId)}
            onClick={handleSave}
            style={{ width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 700 }}
          >
            {saveMutation.isPending ? (
              <>
                <span className="spinner" style={{ borderTopColor: '#fff', marginRight: 8 }} />
                Saving Invoice...
              </>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span>Save &amp; Print Invoice</span>
                <kbd
                  style={{
                    fontSize: 10,
                    background: 'rgba(255,255,255,0.22)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}
                >
                  Ctrl+↵
                </kbd>
              </span>
            )}
          </button>

          {/* Recent Invoices mini-list */}
          <RecentInvoices
            onSelectInvoice={(inv) => {
              setSavedInvoiceId(inv.id);
              setSavedInvoiceData(inv);
              setPreviewModalOpen(true);
            }}
            onEditInvoice={handleEditInvoice}
            onRequestPasswordEdit={(inv) => {
              setPromptInputPassword('');
              setPasswordPromptModal(inv);
            }}
          />
        </div>
      </div>

      {/* ── Client Reference Invoice Modal & Print View ─────────── */}
      {previewModalOpen && savedInvoiceData && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewModalOpen(false)}
          style={{ zIndex: 1000 }}
        >
          <div
            className="modal"
            style={{
              maxWidth: 820,
              width: '95%',
              padding: 0,
              overflow: 'hidden',
              background: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Controls Header */}
            <div
              className="no-print"
              style={{
                padding: '12px 20px',
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} className="text-paid" />
                <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                  Invoice {savedInvoiceData.invoiceNo} Preview
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: (savedInvoiceData.printCount || 0) > 0 ? '#fef3c7' : '#dcfce7',
                    color: (savedInvoiceData.printCount || 0) > 0 ? '#92400e' : '#166534',
                  }}
                >
                  {(savedInvoiceData.printCount || 0) > 0 ? 'COPY' : 'ORIGINAL'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  id="print-reference-invoice-btn"
                  className="btn btn-primary btn-sm"
                  onClick={handlePrintInvoice}
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleExport('pdf')}
                >
                  <FileDown size={14} /> PDF
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleExport('excel')}
                >
                  <FileDown size={14} /> Excel
                </button>
                <button
                  className="btn-icon"
                  onClick={() => setPreviewModalOpen(false)}
                  style={{ marginLeft: 6 }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Reference Document Container */}
            <div
              className="printable-invoice-wrapper"
              style={{
                padding: '20px 24px',
                maxHeight: 'calc(85vh - 70px)',
                overflowY: 'auto',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                background: '#ffffff',
              }}
            >
              {/* Mobile horizontal scroll hint — visible on small touch screens */}
              <div
                className="mobile-invoice-swipe-hint no-print"
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e40af',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                <span>👉 Swipe left/right to view all 13 table columns 👈</span>
              </div>

              <div
                id="printable-reference-invoice"
                style={{
                  fontFamily: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif',
                  color: '#0f172a',
                  lineHeight: 1.35,
                  minWidth: 760,
                }}
              >
                {/* Header matching reference */}
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.02em', color: '#0f172a' }}>
                    {(user?.businessName || 'RAHMAT MEDICAL WHOLESALE').toUpperCase()}, {(user?.city || 'BHIRYA CITY').toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                    {user?.address || 'Main Bazar, Bhirya City'}
                  </div>
                </div>

                <div style={{ borderBottom: '2px solid #0f172a', marginBottom: 10 }} />

                {/* Metadata block with clean 2-column balanced grid */}
                <div
                  className="invoice-meta-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
                    gap: '6px 20px',
                    fontSize: 11.5,
                    marginBottom: 12,
                    background: '#f8fafc',
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {/* Row 1: Est# & Status | INVOICE & Page */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>
                      Est# {savedInvoiceData.invoiceNo}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 8px',
                        borderRadius: 4,
                        background: savedInvoiceData.invoiceType === 'CASH' ? '#dcfce7' : '#ede9fe',
                        color: savedInvoiceData.invoiceType === 'CASH' ? '#166534' : '#6d28d9',
                        border: `1px solid ${savedInvoiceData.invoiceType === 'CASH' ? '#86efac' : '#ddd6fe'}`,
                      }}
                    >
                      {savedInvoiceData.invoiceType === 'CASH' ? 'CASH SALE' : 'CREDIT SALE'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.12em', color: '#1e293b' }}>
                      INVOICE
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      Page# 1 of 1
                    </span>
                  </div>

                  {/* Row 2: Customer (Party) & Area */}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Party: </span>
                    <strong style={{ color: '#0f172a', wordBreak: 'break-word' }}>
                      {savedInvoiceData.customer?.customerCode || '0'} {(savedInvoiceData.customer?.customerName || '').toUpperCase()}
                      {savedInvoiceData.customer?.shopName ? ` (${savedInvoiceData.customer.shopName.toUpperCase()})` : ''}
                    </strong>
                  </div>
                  <div style={{ minWidth: 0, textAlign: 'right' }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Area: </span>
                    <strong style={{ color: '#2563eb', wordBreak: 'break-word' }}>
                      {(savedInvoiceData.customer?.area || 'UNASSIGNED').toUpperCase()}
                    </strong>
                  </div>

                  {/* Row 3: Date/Day/Time & Salesman */}
                  <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11 }}>
                    <span><span style={{ color: '#475569', fontWeight: 600 }}>Date: </span><strong>{fmtDate(savedInvoiceData.invoiceDate)}</strong></span>
                    <span><span style={{ color: '#475569', fontWeight: 600 }}>Day: </span><strong>{getDayName(savedInvoiceData.invoiceDate)}</strong></span>
                    <span><span style={{ color: '#475569', fontWeight: 600 }}>Made At: </span><strong>{formatTime(savedInvoiceData.createdAt)}</strong></span>
                  </div>
                  <div style={{ minWidth: 0, textAlign: 'right', fontSize: 11 }}>
                    {savedInvoiceData.salesman ? (
                      <>
                        <span style={{ color: '#475569', fontWeight: 600 }}>Salesman: </span>
                        <strong style={{ color: '#0f172a' }}>{savedInvoiceData.salesman}</strong>
                      </>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Salesman: —</span>
                    )}
                  </div>

                  {/* Row 4: User/Status & Printed At */}
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, fontSize: 11 }}>
                    <span><span style={{ color: '#475569', fontWeight: 600 }}>User: </span><strong>{(user?.ownerName || 'ADMIN').toUpperCase()}</strong></span>
                    <span>
                      <span style={{ color: '#475569', fontWeight: 600 }}>Status: </span>
                      <strong style={{ color: (savedInvoiceData.printCount || 0) > 0 ? '#b45309' : '#166534' }}>
                        {(savedInvoiceData.printCount || 0) > 0 ? 'COPY' : 'ORIGINAL'}
                      </strong>
                    </span>
                  </div>
                  <div style={{ minWidth: 0, textAlign: 'right', fontSize: 10.5, color: '#475569' }}>
                    <span style={{ fontWeight: 600 }}>Printed At: </span>{new Date().toLocaleString('en-PK')}
                  </div>

                  {/* Optional Note row spanning full width */}
                  {savedInvoiceData.notes && (
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #cbd5e1', paddingTop: 6, marginTop: 2, fontSize: 11, color: '#334155' }}>
                      <strong style={{ color: '#475569' }}>Note: </strong>{savedInvoiceData.notes}
                    </div>
                  )}
                </div>

                {/* 13-Column Reference Table */}
                <table
                  style={{
                    width: '100%',
                    minWidth: 760,
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                    fontSize: 11,
                    marginBottom: 8,
                  }}
                >
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#ffffff', fontSize: 10, textAlign: 'left' }}>
                      <th className="col-seq" style={{ padding: '6px 4px', textAlign: 'center', width: '3.5%', minWidth: 28 }}>S#</th>
                      <th className="col-pkt" style={{ padding: '6px 4px', textAlign: 'center', width: '4.8%', minWidth: 36 }}>PKT</th>
                      <th className="col-price" style={{ padding: '6px 4px', textAlign: 'right', width: '8.5%', minWidth: 64 }}>PRICE</th>
                      <th className="col-item" style={{ padding: '6px 8px', textAlign: 'left', width: '22%', minWidth: 160 }}>ITEM</th>
                      <th className="col-packing" style={{ padding: '6px 4px', textAlign: 'left', width: '7%', minWidth: 52 }}>PACKING</th>
                      <th className="col-disc" style={{ padding: '6px 4px', textAlign: 'center', width: '4.8%', minWidth: 38 }}>DIS%</th>
                      <th className="col-discamt" style={{ padding: '6px 4px', textAlign: 'right', width: '7%', minWidth: 54 }}>DIS AMT</th>
                      <th className="col-stu" style={{ padding: '6px 4px', textAlign: 'center', width: '4.5%', minWidth: 34 }}>ST/U</th>
                      <th className="col-st" style={{ padding: '6px 4px', textAlign: 'right', width: '5.5%', minWidth: 42 }}>ST</th>
                      <th className="col-net" style={{ padding: '6px 4px', textAlign: 'right', width: '9%', minWidth: 68 }}>NET</th>
                      <th className="col-pcs" style={{ padding: '6px 4px', textAlign: 'center', width: '4.5%', minWidth: 34 }}>PCS</th>
                      <th className="col-batch" style={{ padding: '6px 4px', textAlign: 'left', width: '9%', minWidth: 68 }}>BATCH</th>
                      <th className="col-gross" style={{ padding: '6px 4px', textAlign: 'right', width: '8.5%', minWidth: 64 }}>GROSS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(savedInvoiceData.items || []).map((item, idx) => {
                      const mode = item.pricingMode || 'TP';
                      const suffix = mode === 'TP' ? 'T' : mode === 'RETAIL' ? 'R' : 'N';
                      const qty = parseFloat(item.qty || 0);
                      const unitPrice = parseFloat(item.unitPrice || 0);
                      const gross = parseFloat(item.grossTotal || (qty * unitPrice));
                      const discAmt = parseFloat(item.discountAmt || (gross * (parseFloat(item.discount || 0) / 100)));
                      const net = parseFloat(item.total || (gross - discAmt));
                      const stu = parseFloat(item.schemeUnits || 0);
                      const st = parseFloat(item.schemeTotal || 0);
                      const pcs = parseFloat(item.freePcs || 0);
                      const itemName = (item.product?.productName || item.customName || '—').toUpperCase();

                      return (
                        <tr
                          key={item.id || idx}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: idx % 2 === 1 ? '#f8fafc' : '#ffffff',
                          }}
                        >
                          <td className="col-seq" style={{ padding: '5px 4px', textAlign: 'center', color: '#64748b' }}>
                            {idx + 1}
                          </td>
                          <td className="col-pkt" style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 600 }}>
                            {qty}
                          </td>
                          <td className="col-price" style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {unitPrice.toFixed(0)} <span style={{ fontSize: 9, color: '#2563eb' }}>{suffix}</span>
                          </td>
                          <td className="col-item" style={{ padding: '5px 8px', fontWeight: 700, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            {itemName}
                            {item.customName && !item.product && (
                              <span style={{ fontSize: 9, marginLeft: 5, padding: '1px 5px', borderRadius: 3, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                                MANUAL
                              </span>
                            )}
                          </td>
                          <td className="col-packing" style={{ padding: '5px 4px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.packing || item.product?.unit || '—'}
                          </td>
                          <td className="col-disc" style={{ padding: '5px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {parseFloat(item.discount || 0) > 0 ? `${parseFloat(item.discount)}%` : '0%'}
                          </td>
                          <td className="col-discamt" style={{ padding: '5px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {discAmt > 0 ? discAmt.toFixed(0) : '0'}
                          </td>
                          <td className="col-stu" style={{ padding: '5px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {stu > 0 ? stu : '0'}
                          </td>
                          <td className="col-st" style={{ padding: '5px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {st > 0 ? st.toFixed(0) : '0'}
                          </td>
                          <td className="col-net" style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {net.toFixed(0)}
                          </td>
                          <td className="col-pcs" style={{ padding: '5px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {pcs > 0 ? pcs : '0'}
                          </td>
                          <td className="col-batch" style={{ padding: '5px 4px', fontSize: 10, color: '#475569', wordBreak: 'break-all' }}>
                            {item.batchNo || item.product?.batchNo || '—'}
                          </td>
                          <td className="col-gross" style={{ padding: '5px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {gross.toFixed(0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* << TOTAL >> Row */}
                {(() => {
                  const itemsList = savedInvoiceData.items || [];
                  const totGross = itemsList.reduce((s, i) => s + parseFloat(i.grossTotal || (parseFloat(i.qty) * parseFloat(i.unitPrice))), 0);
                  const totDisc = itemsList.reduce((s, i) => s + parseFloat(i.discountAmt || 0), 0);
                  const totScheme = itemsList.reduce((s, i) => s + parseFloat(i.schemeTotal || 0), 0);
                  const totNet = parseFloat(savedInvoiceData.totalAmount || 0);

                  const prv = parseFloat(savedInvoiceData.prvBalance || 0);
                  const paidVal = parseFloat(savedInvoiceData.paidAmount || 0);
                  const balVal = prv + totNet - paidVal;

                  return (
                    <>
                      <div
                        className="invoice-total-row"
                        style={{
                          background: '#f1f5f9',
                          padding: '6px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontWeight: 700,
                          fontSize: 11,
                          borderTop: '1px solid #cbd5e1',
                          borderBottom: '1px solid #cbd5e1',
                          marginBottom: 10,
                          flexWrap: 'wrap',
                          gap: '6px 16px',
                        }}
                      >
                        <div style={{ letterSpacing: '0.05em' }}>&lt;&lt; TOTAL &gt;&gt;</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontVariantNumeric: 'tabular-nums' }}>
                          <span>Dis Amt: {totDisc.toFixed(0)}</span>
                          <span>Gross: {totGross.toFixed(0)}</span>
                          <span>Scheme: {totScheme.toFixed(0)}</span>
                          <span style={{ color: '#1e40af' }}>Net: {totNet.toFixed(0)}</span>
                        </div>
                      </div>

                      {/* Footer Balance Block matching reference */}
                      <div
                        className="invoice-balance-grid"
                        style={{
                          border: '1.5px solid #cbd5e1',
                          borderRadius: 4,
                          padding: '8px 14px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '8px 16px',
                          fontSize: 12,
                          fontWeight: 700,
                          background: '#fafafa',
                          alignItems: 'center',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <div>
                          <span style={{ color: '#64748b', fontSize: 11 }}>Inv Total: </span>
                          <strong>Rs {totNet.toLocaleString('en-PK', { minimumFractionDigits: 0 })}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', fontSize: 11 }}>Prv: </span>
                          <strong style={{ color: prv > 0 ? '#b45309' : '#166534' }}>
                            Rs {prv.toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                          </strong>
                        </div>
                        {paidVal > 0 && (
                          <div style={{ color: '#166534' }}>
                            <span style={{ color: '#64748b', fontSize: 11 }}>Paid: </span>
                            <strong>Rs {paidVal.toLocaleString('en-PK', { minimumFractionDigits: 0 })}</strong>
                          </div>
                        )}
                        <div style={{ color: '#1e40af', fontSize: 13 }}>
                          <span style={{ color: '#64748b', fontSize: 11 }}>Balance: </span>
                          <strong>Rs {balVal.toLocaleString('en-PK', { minimumFractionDigits: 0 })}</strong>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 10,
                    color: '#94a3b8',
                    marginTop: 16,
                    fontStyle: 'italic',
                  }}
                >
                  Thank you for your business. Computer generated invoice.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Past Invoice Password Prompt Modal ── */}
      {passwordPromptModal && (
        <div
          className="modal-overlay"
          onClick={() => setPasswordPromptModal(null)}
          style={{ zIndex: 1100 }}
        >
          <div
            className="modal"
            style={{ maxWidth: 420, width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={16} style={{ color: '#d97706' }} />
                <span style={{ fontWeight: 700 }}>Authorize Past Invoice Edit</span>
              </div>
              <button className="btn-icon" onClick={() => setPasswordPromptModal(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Invoice <strong>{passwordPromptModal.invoiceNo}</strong> is dated{' '}
                <strong>{fmtDate(passwordPromptModal.invoiceDate)}</strong>. Please enter the Store Owner / Admin password to authorize editing this past invoice.
              </p>
              <div className="form-group">
                <label className="form-label">Admin / Owner Password *</label>
                <input
                  id="admin-edit-pass-input"
                  type="password"
                  className="form-input"
                  placeholder="Enter store owner password..."
                  autoFocus
                  value={promptInputPassword}
                  onChange={(e) => setPromptInputPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!promptInputPassword.trim()) {
                        toast.error('Please enter the password.');
                        return;
                      }
                      const targetInv = passwordPromptModal;
                      const pwd = promptInputPassword.trim();
                      setPasswordPromptModal(null);
                      handleEditInvoice(targetInv, pwd);
                    }
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', padding: 8, borderRadius: 4, border: '1px solid #e2e8f0' }}>
                ℹ️ Running balances for this customer will be automatically recalculated across all subsequent transactions upon saving.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setPasswordPromptModal(null)}>Cancel</button>
              <button
                id="confirm-admin-pass-btn"
                className="btn btn-primary"
                onClick={() => {
                  if (!promptInputPassword.trim()) {
                    toast.error('Please enter the password.');
                    return;
                  }
                  const targetInv = passwordPromptModal;
                  const pwd = promptInputPassword.trim();
                  setPasswordPromptModal(null);
                  handleEditInvoice(targetInv, pwd);
                }}
              >
                Authorize &amp; Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecentInvoices({ onSelectInvoice, onEditInvoice, onRequestPasswordEdit }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices-recent', debouncedSearch],
    queryFn: () => invoicesAPI.list({ search: debouncedSearch.trim() || undefined, limit: debouncedSearch.trim() ? 25 : 8 }).then((r) => r.data),
  });
  const invoices = data?.data || [];
  function pkr(v) {
    return `Rs ${parseFloat(v || 0).toFixed(0)}`;
  }
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Past Invoices</span>
          <span className="text-muted text-xs">Search &amp; Edit</span>
        </div>
        <div className="search-input-wrap" style={{ maxWidth: '100%', marginBottom: 0 }}>
          <Search size={13} />
          <input
            id="search-recent-invoices-input"
            className="form-input"
            style={{ fontSize: 12, padding: '5px 8px 5px 28px' }}
            placeholder="Search by Invoice # (e.g. INV-001) or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 16, textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }} /></div>
      ) : invoices.length === 0 ? (
        <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          {searchTerm ? 'No matching invoices found.' : 'No past invoices.'}
        </div>
      ) : (
        invoices.map((inv) => {
          const invDateStr = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '';
          const isSameDay = invDateStr === todayStr;

          return (
            <div
              key={inv.id}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border)',
                fontSize: 12,
                cursor: 'pointer',
              }}
              onClick={() => onSelectInvoice && onSelectInvoice(inv)}
              title="Click to view/print invoice"
            >
              <div className="flex justify-between items-center">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--primary, #2563eb)' }}>{inv.invoiceNo}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    ({invDateStr ? fmtDate(invDateStr) : ''})
                  </span>
                  {inv.invoiceType && (
                    <span
                      className="badge"
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        background: inv.invoiceType === 'CASH' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                        color: inv.invoiceType === 'CASH' ? '#10b981' : '#2563eb',
                      }}
                    >
                      {inv.invoiceType}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`badge badge-${inv.paymentStatus.toLowerCase()}`}>{inv.paymentStatus}</span>
                  {isSameDay ? (
                    onEditInvoice && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ padding: '1px 6px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
                        title="Edit invoice (Same-day)"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditInvoice(inv);
                        }}
                      >
                        <Pencil size={11} /> Edit
                      </button>
                    )
                  ) : (
                    onRequestPasswordEdit && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{
                          padding: '1px 6px',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          borderColor: '#f59e0b',
                          color: '#b45309',
                        }}
                        title="Password required to edit past-dated invoice"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestPasswordEdit(inv);
                        }}
                      >
                        <Lock size={11} /> Edit
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="flex justify-between text-muted" style={{ marginTop: 2 }}>
                <span>{inv.customer?.customerName || inv.customer?.shopName}</span>
                <span className="tabular font-semibold">{pkr(inv.totalAmount)}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
