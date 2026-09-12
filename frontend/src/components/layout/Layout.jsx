// ─────────────────────────────────────────────────────────────
// src/components/layout/Layout.jsx
// Shell: Sidebar + Topbar + Page outlet
// Responsive: hamburger menu, mobile sidebar overlay, bottom nav
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, FileText, ShoppingCart, Users, Building2,
  Package, BookOpen, BookMarked, DollarSign, BarChart2, LogOut,
  Menu, X, MoreHorizontal, Tag, FileSpreadsheet, Landmark,
  MapPin, UserCheck, Layers, Scale, Sheet
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { section: 'Sales' },
  { label: 'Invoicing / Sales', to: '/invoicing', icon: FileText },
  { label: 'Purchasing', to: '/purchasing', icon: ShoppingCart },
  { section: 'Registers' },
  { label: 'Customers', to: '/customers', icon: Users },
  { label: 'Companies', to: '/companies', icon: Building2 },
  { label: 'Cities / Areas', to: '/cities', icon: MapPin },
  { label: 'Inventory', to: '/inventory', icon: Package },
  { label: 'Offer Lists', to: '/offer-lists', icon: Tag },
  { section: 'Ledgers' },
  { label: 'Customer Ledger', to: '/ledger/customer', icon: BookOpen },
  { label: 'Company Ledger', to: '/ledger/company', icon: BookMarked },
  { section: 'Accounting' },
  { label: 'Cash Book', to: '/cash-book', icon: DollarSign },
  { label: 'Bank Accounts', to: '/bank-accounts', icon: Landmark },
  { label: 'Bank Ledger', to: '/ledger/bank', icon: Landmark },
  { label: 'Payroll', to: '/payroll', icon: UserCheck },
  { label: 'Chart of Accounts', to: '/chart-of-accounts', icon: Layers },
  { section: 'Reports' },
  { label: 'Profit & Loss', to: '/reports', icon: BarChart2 },
  { label: 'Party Balance', to: '/reports/party-balance', icon: FileSpreadsheet },
  { label: 'Trial Balance', to: '/reports/trial-balance', icon: Scale },
  { label: 'Balance Sheet', to: '/reports/balance-sheet', icon: Sheet },
];

// Bottom nav items for phone view
const BOTTOM_NAV = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Invoicing', to: '/invoicing', icon: FileText },
  { label: 'Purchasing', to: '/purchasing', icon: ShoppingCart },
  { label: 'Inventory', to: '/inventory', icon: Package },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const today = new Date().toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const initials = (user?.ownerName || 'U').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const currentNav = NAV.find((n) => n.to === location.pathname);
  const pageLabel = currentNav?.label || 'Medical Store Wholesale';

  return (
    <div className="app-layout">
      {/* Mobile sidebar overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <nav className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: 'rgba(255, 255, 255, 0.16)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6EE7B7',
                fontSize: 16,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              +
            </div>
            <div>
              <h1>{user?.businessName || 'Medical Store'}</h1>
              <span>Wholesale Management</span>
            </div>
          </div>
        </div>

        <div className="sidebar-nav">
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} className="nav-section-label">{item.section}</div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            )
          )}
        </div>

        {/* Logout */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <button className="nav-item" style={{ width: '100%', background: 'none', border: 'none' }} onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </nav>

      {/* Main area */}
      <div className="main-area">
        <header className="topbar">
          {/* Hamburger menu — visible on tablet/phone via CSS */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <span className="topbar-title">
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{pageLabel}</span>
          </span>
          <span className="topbar-meta">{today}</span>
          <div className="topbar-user">
            <div className="topbar-avatar">{initials}</div>
            <span>{user?.ownerName}</span>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </div>

      {/* Bottom navigation bar — visible on phone via CSS */}
      <nav className="bottom-nav">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
        <button
          className={`bottom-nav-item${sidebarOpen ? ' active' : ''}`}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <MoreHorizontal size={20} />
          More
        </button>
      </nav>
    </div>
  );
}
