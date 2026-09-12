// ─────────────────────────────────────────────────────────────
// src/App.jsx — Root router with auth guard and offline detection
// ─────────────────────────────────────────────────────────────
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect, useState } from 'react';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Invoicing from './pages/Invoicing';
import Purchasing from './pages/Purchasing';
import Customers from './pages/Customers';
import Companies from './pages/Companies';
import Inventory from './pages/Inventory';
import CustomerLedger from './pages/CustomerLedger';
import CompanyLedger from './pages/CompanyLedger';
import CashBook from './pages/CashBook';
import Reports from './pages/Reports';
import OfferLists from './pages/OfferLists';
import PartyBalanceReport from './pages/PartyBalanceReport';
import BankAccounts from './pages/BankAccounts';
import BankLedger from './pages/BankLedger';
import Cities from './pages/Cities';
import Employees from './pages/Employees';
import ChartOfAccounts from './pages/ChartOfAccounts';
import TrialBalance from './pages/TrialBalance';
import BalanceSheet from './pages/BalanceSheet';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-page"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner">
      ⚠️ No Internet Connection — Please reconnect to use the application
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <OfflineBanner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="invoicing" element={<Invoicing />} />
              <Route path="purchasing" element={<Purchasing />} />
              <Route path="customers" element={<Customers />} />
              <Route path="companies" element={<Companies />} />
              <Route path="cities" element={<Cities />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="ledger/customer" element={<CustomerLedger />} />
              <Route path="ledger/company" element={<CompanyLedger />} />
              <Route path="cash-book" element={<CashBook />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reports/party-balance" element={<PartyBalanceReport />} />
              <Route path="offer-lists" element={<OfferLists />} />
              <Route path="bank-accounts" element={<BankAccounts />} />
              <Route path="ledger/bank" element={<BankLedger />} />
              <Route path="payroll" element={<Employees />} />
              <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
              <Route path="reports/trial-balance" element={<TrialBalance />} />
              <Route path="reports/balance-sheet" element={<BalanceSheet />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif' } }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
