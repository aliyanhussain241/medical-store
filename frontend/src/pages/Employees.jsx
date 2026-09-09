// ─────────────────────────────────────────────────────────────
// src/pages/Employees.jsx — Employee Register & Payroll / Salary Vouchers
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesAPI, bankAccountsAPI } from '../api/services';
import useDebounce from '../utils/useDebounce';
import toast from 'react-hot-toast';
import {
  Plus, Search, Pencil, Trash2, X, UserCheck, DollarSign,
  History, Building2, Wallet, Calendar, AlertCircle
} from 'lucide-react';
import { handleFormEnterKey } from '../utils/keyboardNav';

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
  paymentDate: new Date().toISOString().slice(0, 10),
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
      paymentDate: new Date().toISOString().slice(0, 10),
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Payroll &amp; Employees</h2>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Manage staff records, monthly salaries, and disburse salary vouchers to Cash or Bank Book.
          </p>
        </div>
        <button id="add-employee-btn" className="btn btn-primary" onClick={openAdd}>
          <Plus size={14} /> Add Employee
        </button>
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input
            id="employee-search"
            type="text"
            className="form-input"
            placeholder="Search by name, designation, town..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-muted">{employees.length} employees</span>
      </div>

      <div className="card">
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>Town / Sector</th>
                <th className="num">Monthly Salary</th>
                <th>Status</th>
                <th style={{ width: 220, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32 }}>
                    <div className="spinner" style={{ margin: 'auto' }} />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    <UserCheck size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <p>No employees found. Click &quot;Add Employee&quot; to get started.</p>
                  </td>
                </tr>
              ) : (
                employees.map((emp, idx) => (
                  <tr key={emp.id} style={{ opacity: emp.isActive ? 1 : 0.6 }}>
                    <td className="text-muted">{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{emp.employeeName}</span>
                      </div>
                    </td>
                    <td>{emp.designation || '—'}</td>
                    <td className="text-muted text-sm">
                      {emp.town ? `${emp.town}${emp.sector ? `, ${emp.sector}` : ''}` : '—'}
                    </td>
                    <td className="num tabular" style={{ fontWeight: 700, color: 'var(--text)' }}>
                      {pkr(emp.salary)}
                    </td>
                    <td>
                      <span className={`badge ${emp.isActive ? 'badge-paid' : 'badge-pending'}`}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions-group" style={{ justifyContent: 'center' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          title="Pay Salary"
                          onClick={() => openPay(emp)}
                          disabled={!emp.isActive}
                        >
                          <DollarSign size={13} /> <span className="lbl">Pay</span>
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          title="View Payment History"
                          onClick={() => openHistory(emp)}
                        >
                          <History size={13} />
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
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add New Employee' : 'Edit Employee'}</h3>
              <button className="btn-icon" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleEmpSubmit} onKeyDown={(e) => handleFormEnterKey(e, handleEmpSubmit)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Employee Full Name <span className="req">*</span></label>
                  <input
                    className="form-control"
                    placeholder="e.g. Muhammad Ali"
                    value={empForm.employeeName}
                    onChange={(e) => setEmpForm({ ...empForm, employeeName: e.target.value })}
                    autoFocus
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Designation / Role</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Salesman, Pharmacist"
                      value={empForm.designation}
                      onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Salary (PKR) <span className="req">*</span></label>
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      placeholder="e.g. 35000"
                      value={empForm.salary}
                      onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Town</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Model Town"
                      value={empForm.town}
                      onChange={(e) => setEmpForm({ ...empForm, town: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sector / Block</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Block B"
                      value={empForm.sector}
                      onChange={(e) => setEmpForm({ ...empForm, sector: e.target.value })}
                    />
                  </div>
                </div>

                {modal === 'edit' && (
                  <div className="form-group" style={{ marginTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={empForm.isActive}
                        onChange={(e) => setEmpForm({ ...empForm, isActive: e.target.checked })}
                      />
                      <span style={{ fontWeight: 500, fontSize: 13 }}>Employee is active</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
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
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Salary Payment Voucher</h3>
              <button className="btn-icon" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handlePaySubmit} onKeyDown={(e) => handleFormEnterKey(e, handlePaySubmit)}>
              <div className="modal-body">
                {/* Employee Snapshot */}
                <div
                  style={{
                    background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
                    {activeEmp.employeeName}
                  </div>
                  <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                    {activeEmp.designation || 'Staff'} • Standard Salary: {pkr(activeEmp.salary)}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Payment Date <span className="req">*</span></label>
                    <input
                      type="date"
                      className="form-control"
                      value={payForm.paymentDate}
                      onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (PKR) <span className="req">*</span></label>
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      placeholder="Amount"
                      value={payForm.amount}
                      onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method <span className="req">*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      className={`btn ${payForm.paymentMethod === 'CASH' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onClick={() => setPayForm({ ...payForm, paymentMethod: 'CASH', bankAccountId: '' })}
                    >
                      <Wallet size={15} /> Cash Book
                    </button>
                    <button
                      type="button"
                      className={`btn ${payForm.paymentMethod === 'BANK' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onClick={() => setPayForm({ ...payForm, paymentMethod: 'BANK' })}
                    >
                      <Building2 size={15} /> Bank Account
                    </button>
                  </div>
                </div>

                {payForm.paymentMethod === 'BANK' && (
                  <div className="form-group">
                    <label className="form-label">Select Bank Account <span className="req">*</span></label>
                    <select
                      className="form-control"
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
                  <label className="form-label">Narration / Remarks</label>
                  <input
                    className="form-control"
                    placeholder="e.g. Salary for September 2026"
                    value={payForm.narration}
                    onChange={(e) => setPayForm({ ...payForm, narration: e.target.value })}
                  />
                  <span className="text-muted text-xs" style={{ marginTop: 4, display: 'block' }}>
                    Automatically posted to {payForm.paymentMethod === 'CASH' ? 'Cash Book' : 'Bank Book'} under the &quot;Salary&quot; expense head.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
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
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3>Salary Payment History</h3>
                <p className="text-muted text-xs" style={{ marginTop: 2 }}>
                  {activeEmp.employeeName} ({activeEmp.designation || 'Staff'})
                </p>
              </div>
              <button className="btn-icon" onClick={closeModal}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: 'auto' }} /></div>
              ) : !historyData?.data || historyData.data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Calendar size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p>No past salary payments found for this employee.</p>
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: 13 }}>
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
                        <td>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td>
                          <span className={`badge ${p.paymentMethod === 'CASH' ? 'badge-paid' : 'badge-partial'}`}>
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="text-muted text-xs">
                          {p.bankAccount ? `${p.bankAccount.bankName} (${p.bankAccount.accountTitle})` : 'Cash Drawer'}
                        </td>
                        <td className="num tabular" style={{ fontWeight: 600 }}>{pkr(p.amount)}</td>
                        <td className="text-muted text-xs">{p.narration || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Close</button>
            </div>
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
              <p>Are you sure you want to delete this employee? Employees with recorded payments cannot be deleted and should be marked inactive instead.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelId(null)}>Cancel</button>
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
