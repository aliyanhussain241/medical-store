// ─────────────────────────────────────────────────────────────
// src/components/ui/PillBadge.jsx
// Standardized pill badge for status, financial DR/CR, payment modes, etc.
// ─────────────────────────────────────────────────────────────
import React from 'react';

const VARIANT_MAP = {
  // Payment / Invoicing status
  PAID: { label: 'PAID', bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  UNPAID: { label: 'UNPAID', bg: '#FEE2E2', color: '#B4372B', border: '#FECACA' },
  PARTIAL: { label: 'PARTIAL', bg: '#DBEAFE', color: '#1B4B91', border: '#BFDBFE' },
  PENDING: { label: 'PENDING', bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  OVERDUE: { label: 'OVERDUE', bg: '#FEE2E2', color: '#B4372B', border: '#FECACA' },
  CANCELLED: { label: 'CANCELLED', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },

  // Ledgers & Accounting
  DR: { label: 'DR', bg: '#FEE2E2', color: '#B4372B', border: '#FECACA' },
  CR: { label: 'CR', bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  DEBIT: { label: 'DEBIT', bg: '#FEE2E2', color: '#B4372B', border: '#FECACA' },
  CREDIT: { label: 'CREDIT', bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  CASH: { label: 'CASH', bg: '#ECFDF5', color: '#0F6E4F', border: '#A7F3D0' },
  BANK: { label: 'BANK', bg: '#EEF2FF', color: '#4F46E5', border: '#C7D2FE' },

  // General & Inventory
  ACTIVE: { label: 'ACTIVE', bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  INACTIVE: { label: 'INACTIVE', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
  LOW_STOCK: { label: 'LOW STOCK', bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  EXPIRED: { label: 'EXPIRED', bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  NEAR_EXPIRY: { label: 'NEAR EXPIRY', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
};

export default function PillBadge({ variant, children, bg, color, border, className = '' }) {
  const norm = typeof variant === 'string' ? variant.toUpperCase() : '';
  const preset = VARIANT_MAP[norm] || {};

  const style = {
    background: bg || preset.bg || '#F1F5F9',
    color: color || preset.color || '#475569',
    borderColor: border || preset.border || 'transparent',
  };

  return (
    <span className={`pill-badge ${className}`} style={style}>
      {children || preset.label || variant}
    </span>
  );
}
