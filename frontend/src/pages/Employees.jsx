import { businessDay } from '../utils/businessDate';
// ─────────────────────────────────────────────────────────────
// src/pages/Employees.jsx — Employee Register & Payroll / Salary Vouchers
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesAPI, bankAccountsAPI } from '../api/services';
import useDebounce from '../utils/useDebounce';
import toast from 'react-hot-toast';
import {
  Plus, Search, Pencil, Trash2, X, Users, DollarSign,
  History, Building2, Wallet, Calendar, CheckCircle2, UserCheck
} from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';
import { PageHeader, KpiGrid, KpiCard, EmptyState, TableSkeleton } from '../components/ui';

function pkr(v) {
  return `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
}

const EMPTY_EMP = {
  employeeName: '',
  designation: '',
  salary: '',
  town: '',
  sector: '',
  isActive: true,
};

const EMPTY_PAY = {
  amount: '',
  paymentDate: businessDay(),
  paymentMethod: 'CASH',
  bankAccountId: '',
  narration: '',
};

export default function Employees() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'pay' | 'history'
  const [empForm, setEmpForm] = useState(EMPTY_EMP);
  const [payForm, setPayForm] = useState(EMPTY_PAY);
  const [activeEmp, setActiveEmp] = useState(null);
  const [delId, setDelId] = useState(null);

  const debouncedSearch = useDebounce(search, 300);

  // Fetch employees
  const { data: empData, isLoading } = useQuery({
    queryKey: ['employees', debouncedSearch],
    queryFn: () => employeesAPI.list({ search: debouncedSearch }).then((r) => r.data),
  });

  // Fetch bank accounts for salary payment modal
  const { data: bankData } = useQuery({
    queryKey: ['bank-accounts-all'],
    queryFn: () => bankAccountsAPI.list({ limit: 100 }).then((r) => r.data),
    enabled: modal === 'pay',
  });

  // Fetch salary history for selected employee
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['employee-history', activeEmp?.id],
    queryFn: () => employeesAPI.salaryHistory(activeEmp.id).then((r) => r.data),
    enabled: modal === 'history' && !!activeEmp?.id,
  });

  const saveEmpMutation = useMutation({
    mutationFn: (d) => activeEmp ? employeesAPI.update(activeEmp.id, d) : employeesAPI.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['employees']);
      toast.success(activeEmp ? 'Employee updated.' : 'Employee added.');
      closeModal();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error saving employee.'),
  });

  const deleteEmpMutation = useMutation({
    mutationFn: (id) => employeesAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['employees']);
      toast.success('Employee deleted.');
      setDelId(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot delete employee.'),
  });

  const paySalaryMutation = useMutation({
    mutationFn: (d) => employeesAPI.paySalary(activeEmp.id, d),
    onSuccess: () => {
      qc.invalidateQueries(['employees']);
      qc.invalidateQueries(['cash-book']);
      qc.invalidateQueries(['bank-book']);
      qc.invalidateQueries(['account-heads']);
      toast.success('Salary payment recorded successfully.');
      closeModal();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error recording salary payment.'),
  });

  function openAdd() {
    setActiveEmp(null);
    setEmpForm(EMPTY_EMP);
    setModal('add');
  }

  function openEdit(emp) {
    setActiveEmp(emp);
    setEmpForm({
      employeeName: emp.employeeName,
      designation: emp.designation || '',
      salary: emp.salary,
      town: emp.town || '',
      sector: emp.sector || '',
      isActive: emp.isActive,
    });
    setModal('edit');
  }

  function openPay(emp) {
    setActiveEmp(emp);
    setPayForm({
      amount: emp.salary,
      paymentDate: businessDay(),
      paymentMethod: 'CASH',
      bankAccountId: '',
      narration: `Salary for ${new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}`,
    });
    setModal('pay');
  }

  function openHistory(emp) {
    setActiveEmp(emp);
    setModal('history');
  }

  function closeModal() {
    setModal(null);
    setActiveEmp(null);
    setEmpForm(EMPTY_EMP);
    setPayForm(EMPTY_PAY);
  }

  function handleEmpSubmit(e) {
    e.preventDefault();
    if (!empForm.employeeName.trim()) {
      toast.error('Employee name is required.');
      return;
    }
    if (!empForm.salary || parseFloat(empForm.salary) <= 0) {
      toast.error('Valid salary amount is required.');
      return;
    }
    saveEmpMutation.mutate(empForm);
  }

  function handlePaySubmit(e) {
    e.preventDefault();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      toast.error('Payment amount must be greater than 0.');
      return;
    }
    if (payForm.paymentMethod === 'BANK' && !payForm.bankAccountId) {
      toast.error('Please select a bank account.');
      return;
    }
    paySalaryMutation.mutate(payForm);
  }

  const employees = empData?.data || [];
  const bankAccounts = bankData?.data || [];
  const activeCount = employees.filter((e) => e.isActive).length;
  const totalPayroll = employees.filter((e) => e.isActive).reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll & Employees"
        subtitle="Manage staff records, monthly salary obligations, and disburse salary vouchers to Cash or Bank Book"
        actions={
          <button id="add-employee-btn" className="btn btn-primary" onClick={openAdd}>
            <Plus size={14} /> Add Employee
          </button>
        }
      />

      {/* KPI Cards */}
      <KpiGrid cols={2}>
        <KpiCard
          title="Total Staff"
          value={employees.length}
          caption={`${activeCount} active, ${employees.length - activeCount} inactive`}
          icon={Users}
          accentColor="brand"
          badge="ROSTER"
        />
        <KpiCard
          title="Monthly Payroll"
          value={pkr(totalPayroll)}
          caption="Total monthly recurring salary liability"
          icon={DollarSign}
          accentColor="rose"
          badge="LIABILITY"
        />
      </KpiGrid>

      {/* Search / Filter Bar */}
      <div className="app-filter-bar">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
          <div className="search-input-wrap" style={{ flex: '1 1 280px', minWidth: 240 }}>
            <Search size={14} />
            <input
              id="employee-search"
              type="text"
              className="form-input text-sm"
              placeholder="Search by name, designation, town..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-muted ml-auto">
            {employees.length} employees found
          </span>
        </div>
      </div>

      {/* Table Card */}
      <div className="app-table-card">
        <div className="flex items-center justify-between p-3 border-b border-border bg-subtle">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Staff Register</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt font-medium text-muted">
              {employees.length} members
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>Town / Sector</th>
                <th className="num" style={{ width: 140 }}>Monthly Salary</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 220, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={7} rows={4} />
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <EmptyState
                      icon={UserCheck}
                      title="No employees found"
                      description="Click Add Employee to register staff and configure their monthly salaries."
                      actionLabel="+ Add Employee"
                      onAction={openAdd}
                    />
                  </td>
                </tr>
              ) : (
                employees.map((emp, idx) => (
                  <tr key={emp.id} style={{ opacity: emp.isActive ? 1 : 0.65 }}>
                    <td className="text-muted text-xs">{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      <div className="flex items-center gap-2">
                        <span>{emp.employeeName}</span>
                      </div>
                    </td>
                    <td className="text-sm font-medium">{emp.designation || '—'}</td>
                    <td className="text-muted text-xs">
                      {emp.town ? `${emp.town}${emp.sector ? `, ${emp.sector}` : ''}` : '—'}
                    </td>
                    <td className="num tabular font-bold text-text">
                      {pkr(emp.salary)}
                    </td>
                    <td>
                      <span className={`badge ${emp.isActive ? 'badge-paid' : 'badge-pending'}`}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2 justify-center items-center">
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          title="Pay Salary"
                          onClick={() => openPay(emp)}
                          disabled={!emp.isActive}
                        >
                          <DollarSign size={13} /> Pay
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          title="View Payment History"
                          onClick={() => openHistory(emp)}
                        >
                          <History size={13} /> History
                        </button>
                        <button
                          className="btn-icon"
                          title="Edit Employee"
                          onClick={() => openEdit(emp)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Delete Employee"
                          onClick={() => setDelId(emp.id)}
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
      </div>

      {/* Add / Edit Employee Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-brand" />
                <span className="font-semibold text-base">{modal === 'add' ? 'Add New Employee' : 'Edit Employee'}</span>
              </div>
              <button className="btn-icon" onClick={closeModal}><X size={15} /></button>
            </div>
            <form onSubmit={handleEmpSubmit} onKeyDown={(e) => handleFormEnterKey(e, handleEmpSubmit)}>
              <div className="modal-body space-y-3">
                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Employee Full Name *</label>
                  <input
                    className="form-input text-sm"
                    placeholder="e.g. Muhammad Ali"
                    value={empForm.employeeName}
                    onChange={(e) => setEmpForm({ ...empForm, employeeName: e.target.value })}
                    autoFocus
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Designation / Role</label>
                    <input
                      className="form-input text-sm"
                      placeholder="e.g. Salesman, Pharmacist"
                      value={empForm.designation}
                      onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Monthly Salary (PKR) *</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input text-sm tabular font-semibold"
                      placeholder="e.g. 35000"
                      value={empForm.salary}
                      onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Town</label>
                    <input
                      className="form-input text-sm"
                      placeholder="e.g. Model Town"
                      value={empForm.town}
                      onChange={(e) => setEmpForm({ ...empForm, town: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Sector / Block</label>
                    <input
                      className="form-input text-sm"
                      placeholder="e.g. Block B"
                      value={empForm.sector}
                      onChange={(e) => setEmpForm({ ...empForm, sector: e.target.value })}
                    />
                  </div>
                </div>

                {modal === 'edit' && (
                  <div className="form-group mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={empForm.isActive}
                        onChange={(e) => setEmpForm({ ...empForm, isActive: e.target.checked })}
                      />
                      <span>Employee is active</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saveEmpMutation.isPending}>
                  {saveEmpMutation.isPending ? 'Saving...' : (modal === 'add' ? 'Add Employee' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Salary Modal */}
      {modal === 'pay' && activeEmp && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-brand" />
                <span className="font-semibold text-base">Salary Payment Voucher</span>
              </div>
              <button className="btn-icon" onClick={closeModal}><X size={15} /></button>
            </div>
            <form onSubmit={handlePaySubmit} onKeyDown={(e) => handleFormEnterKey(e, handlePaySubmit)}>
              <div className="modal-body space-y-3">
                {/* Employee Snapshot */}
                <div
                  style={{
                    background: 'var(--subtle, #f8fafc)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '12px 16px',
                  }}
                >
                  <div className="font-semibold text-base text-text">
                    {activeEmp.employeeName}
                  </div>
                  <div className="text-muted text-xs mt-0.5">
                    {activeEmp.designation || 'Staff'} • Standard Salary: {pkr(activeEmp.salary)}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Payment Date *</label>
                    <input
                      type="date"
                      className="form-input text-sm"
                      value={payForm.paymentDate}
                      onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Amount (PKR) *</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input text-sm tabular font-semibold"
                      placeholder="Amount"
                      value={payForm.amount}
                      onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Payment Method *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${payForm.paymentMethod === 'CASH' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onClick={() => setPayForm({ ...payForm, paymentMethod: 'CASH', bankAccountId: '' })}
                    >
                      <Wallet size={14} /> Cash Book
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${payForm.paymentMethod === 'BANK' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onClick={() => setPayForm({ ...payForm, paymentMethod: 'BANK' })}
                    >
                      <Building2 size={14} /> Bank Account
                    </button>
                  </div>
                </div>

                {payForm.paymentMethod === 'BANK' && (
                  <div className="form-group">
                    <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Select Bank Account *</label>
                    <select
                      className="form-select text-sm font-medium"
                      value={payForm.bankAccountId}
                      onChange={(e) => setPayForm({ ...payForm, bankAccountId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Bank Account --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - {b.accountTitle} ({pkr(b.currentBalance)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted">Narration / Remarks</label>
                  <input
                    className="form-input text-sm"
                    placeholder="e.g. Salary for current month"
                    value={payForm.narration}
                    onChange={(e) => setPayForm({ ...payForm, narration: e.target.value })}
                  />
                  <span className="text-muted text-xs mt-1 block">
                    Automatically posted to {payForm.paymentMethod === 'CASH' ? 'Cash Book' : 'Bank Book'} under the &quot;Salary&quot; expense head.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={paySalaryMutation.isPending}>
                  {paySalaryMutation.isPending ? 'Processing...' : 'Disburse Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary History Modal */}
      {modal === 'history' && activeEmp && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="font-semibold text-base">Salary Payment History</div>
                <p className="text-muted text-xs mt-0.5">
                  {activeEmp.employeeName} ({activeEmp.designation || 'Staff'})
                </p>
              </div>
              <button className="btn-icon" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="modal-body p-0" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></div>
              ) : !historyData?.data || historyData.data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Calendar size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p className="text-sm">No past salary payments found for this employee.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Account / Source</th>
                      <th className="num">Amount</th>
                      <th>Narration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.data.map((p) => (
                      <tr key={p.id}>
                        <td className="text-sm font-medium">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td>
                          <span className={`badge ${p.paymentMethod === 'CASH' ? 'badge-paid' : 'badge-brand'}`}>
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="text-muted text-xs">
                          {p.bankAccount ? `${p.bankAccount.bankName} (${p.bankAccount.accountTitle})` : 'Cash Drawer'}
                        </td>
                        <td className="num tabular font-bold text-text">{pkr(p.amount)}</td>
                        <td className="text-muted text-xs">{p.narration || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Close</button>
            </div>
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
              <p className="text-sm text-muted">Are you sure you want to delete this employee? Employees with recorded payments cannot be deleted and should be marked inactive instead.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDelId(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={deleteEmpMutation.isPending}
                onClick={() => deleteEmpMutation.mutate(delId)}
              >
                {deleteEmpMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
