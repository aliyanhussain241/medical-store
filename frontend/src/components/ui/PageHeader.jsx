// ─────────────────────────────────────────────────────────────
// src/components/ui/PageHeader.jsx
// Standard page header matching Dashboard typography and layout
// ─────────────────────────────────────────────────────────────
import React from 'react';

export default function PageHeader({ title, subtitle, badge, actions, children }) {
  return (
    <div className="app-page-header">
      <div className="app-page-header-left">
        <div className="app-page-title-row">
          <h1 className="app-page-title">{title}</h1>
          {badge && <span className="app-page-badge">{badge}</span>}
        </div>
        {subtitle && <p className="app-page-sub">{subtitle}</p>}
      </div>
      {(actions || children) && (
        <div className="app-page-actions">
          {actions || children}
        </div>
      )}
    </div>
  );
}
