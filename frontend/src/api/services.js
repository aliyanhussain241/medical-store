// ─────────────────────────────────────────────────────────────
// src/api/services.js — All API service functions
// ─────────────────────────────────────────────────────────────
import api from './client';

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  signup: (data) => api.post('/auth/signup', data),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
};

// ── Companies ─────────────────────────────────────────────────
export const companiesAPI = {
  list: (params) => api.get('/companies', { params }),
  get: (id) => api.get(`/companies/${id}`),
  create: (data) => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  delete: (id) => api.delete(`/companies/${id}`),
};

// ── Customers ─────────────────────────────────────────────────
export const customersAPI = {
  list: (params) => api.get('/customers', { params }),
  areas: () => api.get('/customers/areas'),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

// ── Products ──────────────────────────────────────────────────
export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  categories: () => api.get('/products/categories'),
  alerts: () => api.get('/products/alerts'),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  adjustStock: (id, qty, notes) => api.patch(`/products/${id}/adjust-stock`, { qty, notes }),
  delete: (id) => api.delete(`/products/${id}`),
  // Excel import
  importTemplate: () => api.get('/products/import/template', { responseType: 'blob' }),
  importExcel: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/products/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Purchases ─────────────────────────────────────────────────
export const purchasesAPI = {
  list: (params) => api.get('/purchases', { params }),
  get: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
  recordPayment: (id, data) => api.patch(`/purchases/${id}/payment`, data),
};

// ── Invoices ──────────────────────────────────────────────────
export const invoicesAPI = {
  list: (params) => api.get('/invoices', { params }),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  recordPayment: (id, data) => api.patch(`/invoices/${id}/payment`, data),
  markPrinted: (id) => api.patch(`/invoices/${id}/print`),
};

// ── Cities ────────────────────────────────────────────────────
export const citiesAPI = {
  list: (params) => api.get('/cities', { params }),
  create: (data) => api.post('/cities', data),
  update: (id, data) => api.put(`/cities/${id}`, data),
  delete: (id) => api.delete(`/cities/${id}`),
};

// ── Employees (Payroll) ───────────────────────────────────────
export const employeesAPI = {
  list: (params) => api.get('/employees', { params }),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  paySalary: (id, data) => api.post(`/employees/${id}/pay-salary`, data),
  salaryHistory: (id) => api.get(`/employees/${id}/salary-history`),
};

// ── Account Heads (Chart of Accounts) ─────────────────────────
export const accountHeadsAPI = {
  list: (params) => api.get('/account-heads', { params }),
  create: (data) => api.post('/account-heads', data),
  update: (id, data) => api.put(`/account-heads/${id}`, data),
  delete: (id) => api.delete(`/account-heads/${id}`),
};

// ── Ledger ────────────────────────────────────────────────────
export const ledgerAPI = {
  customer: (id, params) => api.get(`/ledger/customer/${id}`, { params }),
  company: (id, params) => api.get(`/ledger/company/${id}`, { params }),
  bank: (id, params) => api.get(`/ledger/bank/${id}`, { params }),
};

// ── Cash Book ─────────────────────────────────────────────────
export const cashBookAPI = {
  list: (params) => api.get('/cash-book', { params }),
  create: (data) => api.post('/cash-book', data),
};

// ── Bank Accounts ─────────────────────────────────────────────
export const bankAccountsAPI = {
  list: (params) => api.get('/bank-accounts', { params }),
  get: (id) => api.get(`/bank-accounts/${id}`),
  create: (data) => api.post('/bank-accounts', data),
  update: (id, data) => api.put(`/bank-accounts/${id}`, data),
  delete: (id) => api.delete(`/bank-accounts/${id}`),
};

// ── Bank Book ─────────────────────────────────────────────────
export const bankBookAPI = {
  list: (params) => api.get('/bank-book', { params }),
  create: (data) => api.post('/bank-book', data),
};

// ── Offer Lists ───────────────────────────────────────────────
export const offerListsAPI = {
  list: (params) => api.get('/offer-lists', { params }),
  get: (id) => api.get(`/offer-lists/${id}`),
  getActiveOffers: () => api.get('/offer-lists/active-offers'),
  create: (data) => api.post('/offer-lists', data),
  update: (id, data) => api.put(`/offer-lists/${id}`, data),
  toggleActive: (id) => api.patch(`/offer-lists/${id}/toggle-active`),
  delete: (id) => api.delete(`/offer-lists/${id}`),
};

// ── Reports ───────────────────────────────────────────────────
export const reportsAPI = {
  profit: (params) => api.get('/reports/profit', { params }),
  partyBalance: (params) => api.get('/reports/party-balance', { params }),
};

// ── Exports (download as blob) ────────────────────────────────
export const exportAPI = {
  invoicePDF: (id) => api.get(`/export/invoice/${id}/pdf`, { responseType: 'blob' }),
  invoiceExcel: (id) => api.get(`/export/invoice/${id}/excel`, { responseType: 'blob' }),
  customerLedgerPDF: (id, params) => api.get(`/export/ledger/customer/${id}/pdf`, { params, responseType: 'blob' }),
  customerLedgerExcel: (id, params) => api.get(`/export/ledger/customer/${id}/excel`, { params, responseType: 'blob' }),
  companyLedgerPDF: (id, params) => api.get(`/export/ledger/company/${id}/pdf`, { params, responseType: 'blob' }),
  companyLedgerExcel: (id, params) => api.get(`/export/ledger/company/${id}/excel`, { params, responseType: 'blob' }),
  bankLedgerPDF: (id, params) => api.get(`/export/ledger/bank/${id}/pdf`, { params, responseType: 'blob' }),
  bankLedgerExcel: (id, params) => api.get(`/export/ledger/bank/${id}/excel`, { params, responseType: 'blob' }),
  cashBookPDF: (params) => api.get('/export/cash-book/pdf', { params, responseType: 'blob' }),
  cashBookExcel: (params) => api.get('/export/cash-book/excel', { params, responseType: 'blob' }),
  profitPDF: (params) => api.get('/export/profit/pdf', { params, responseType: 'blob' }),
  profitExcel: (params) => api.get('/export/profit/excel', { params, responseType: 'blob' }),
  offerListPDF: (id) => api.get(`/export/offer-list/${id}/pdf`, { responseType: 'blob' }),
  offerListExcel: (id) => api.get(`/export/offer-list/${id}/excel`, { responseType: 'blob' }),
  partyBalancePDF: (params) => api.get('/export/party-balance/pdf', { params, responseType: 'blob' }),
  partyBalanceExcel: (params) => api.get('/export/party-balance/excel', { params, responseType: 'blob' }),
};

// ── Helper: trigger file download from blob response ──────────
export function downloadBlob(response, filename) {
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
