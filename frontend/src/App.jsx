// ─────────────────────────────────────────────────────────────
// src/App.jsx — Root router with auth guard, code-splitting,
//               offline detection, and cold-start loading UX
// ─────────────────────────────────────────────────────────────
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessConfigProvider } from './context/BusinessConfigContext';
import { useEffect, useState, lazy, Suspense } from 'react';

// ── Eagerly loaded (critical path — Dashboard + Invoicing) ───
import Login from './pages/Login';
import Signup from './pages/Signup';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Invoicing from './pages/Invoicing';
import ScreenErrorBoundary from './components/ScreenErrorBoundary';

// ── Lazy loaded (secondary screens — loaded on-demand) ───────
const Purchasing = lazy(() => import('./pages/Purchasing'));
const Customers = lazy(() => import('./pages/Customers'));
const Companies = lazy(() => import('./pages/Companies'));
const Inventory = lazy(() => import('./pages/Inventory'));
const CustomerLedger = lazy(() => import('./pages/CustomerLedger'));
const CompanyLedger = lazy(() => import('./pages/CompanyLedger'));
const CashBook = lazy(() => import('./pages/CashBook'));
const Reports = lazy(() => import('./pages/Reports'));
const OfferLists = lazy(() => import('./pages/OfferLists'));
const PartyBalanceReport = lazy(() => import('./pages/PartyBalanceReport'));
const BankAccounts = lazy(() => import('./pages/BankAccounts'));
const BankLedger = lazy(() => import('./pages/BankLedger'));
const Cities = lazy(() => import('./pages/Cities'));
const Employees = lazy(() => import('./pages/Employees'));
const ChartOfAccounts = lazy(() => import('./pages/ChartOfAccounts'));
const TrialBalance = lazy(() => import('./pages/TrialBalance'));
const BalanceSheet = lazy(() => import('./pages/BalanceSheet'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// ── Suspense fallback — polished loading state ───────────────
function PageLoader() {
  return (
    <div className="suspense-loader">
      <div className="spinner" />
      <p>Loading page…</p>
    </div>
  );
}

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
      <BusinessConfigProvider>
        <BrowserRouter>
          <OfflineBanner />
          <ScreenErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="invoicing" element={<Invoicing />} />
              {/* Lazy-loaded routes wrapped in Suspense */}
              <Route path="purchasing" element={<Suspense fallback={<PageLoader />}><Purchasing /></Suspense>} />
              <Route path="customers" element={<Suspense fallback={<PageLoader />}><Customers /></Suspense>} />
              <Route path="companies" element={<Suspense fallback={<PageLoader />}><Companies /></Suspense>} />
              <Route path="cities" element={<Suspense fallback={<PageLoader />}><Cities /></Suspense>} />
              <Route path="inventory" element={<Suspense fallback={<PageLoader />}><Inventory /></Suspense>} />
              <Route path="ledger/customer" element={<Suspense fallback={<PageLoader />}><CustomerLedger /></Suspense>} />
              <Route path="ledger/company" element={<Suspense fallback={<PageLoader />}><CompanyLedger /></Suspense>} />
              <Route path="cash-book" element={<Suspense fallback={<PageLoader />}><CashBook /></Suspense>} />
              <Route path="reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
              <Route path="reports/party-balance" element={<Suspense fallback={<PageLoader />}><PartyBalanceReport /></Suspense>} />
              <Route path="offer-lists" element={<Suspense fallback={<PageLoader />}><OfferLists /></Suspense>} />
              <Route path="bank-accounts" element={<Suspense fallback={<PageLoader />}><BankAccounts /></Suspense>} />
              <Route path="ledger/bank" element={<Suspense fallback={<PageLoader />}><BankLedger /></Suspense>} />
              <Route path="payroll" element={<Suspense fallback={<PageLoader />}><Employees /></Suspense>} />
              <Route path="chart-of-accounts" element={<Suspense fallback={<PageLoader />}><ChartOfAccounts /></Suspense>} />
              <Route path="reports/trial-balance" element={<Suspense fallback={<PageLoader />}><TrialBalance /></Suspense>} />
              <Route path="reports/balance-sheet" element={<Suspense fallback={<PageLoader />}><BalanceSheet /></Suspense>} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </ScreenErrorBoundary>
        </BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif' } }} />
      </BusinessConfigProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
