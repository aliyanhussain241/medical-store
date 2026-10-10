// ─────────────────────────────────────────────────────────────
// src/components/ui/SectionHeader.jsx
// Small uppercase section label with leading icon (matching Dashboard)
// ─────────────────────────────────────────────────────────────
import React from 'react';

export default function SectionHeader({ icon: Icon, label, color = 'var(--brand)', right }) {
  return (
    <div className="app-section-header">
      <div className="app-section-header-left">
        {Icon && <Icon size={14} color={color} />}
        <span className="app-section-label">{label}</span>
      </div>
      {right && <div className="app-section-header-right">{right}</div>}
    </div>
  );
}
