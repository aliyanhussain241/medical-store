// ─────────────────────────────────────────────────────────────
// src/components/ui/KpiGrid.jsx
// Responsive grid for KPI cards (auto-fit or fixed columns 2-4)
// ─────────────────────────────────────────────────────────────
import React from 'react';

export default function KpiGrid({ cols = 4, children, className = '' }) {
  return (
    <div className={`app-kpi-grid app-kpi-grid-${cols} ${className}`}>
      {children}
    </div>
  );
}
