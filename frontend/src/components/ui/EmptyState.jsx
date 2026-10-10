// ─────────────────────────────────────────────────────────────
// src/components/ui/EmptyState.jsx
// Consistent empty state representation across all tables and lists
// ─────────────────────────────────────────────────────────────
import React from 'react';
import { PackageOpen } from 'lucide-react';

export default function EmptyState({
  icon: Icon = PackageOpen,
  title = 'No records found',
  description,
  action,
  className = '',
}) {
  return (
    <div className={`app-empty-state ${className}`}>
      <div className="app-empty-icon-wrap">
        <Icon size={28} className="app-empty-icon" />
      </div>
      <div className="app-empty-title">{title}</div>
      {description && <div className="app-empty-desc">{description}</div>}
      {action && <div className="app-empty-action">{action}</div>}
    </div>
  );
}
