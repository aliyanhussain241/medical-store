// ─────────────────────────────────────────────────────────────
// src/components/ui/KpiCard.jsx
// Dashboard-style KPI card with top color border, icon, badge, large number, subtitle
// ─────────────────────────────────────────────────────────────
import React from 'react';

export default function KpiCard({
  icon: Icon,
  iconBg = '#ECFDF5',
  iconColor = '#0F6E4F',
  badge,
  badgeColor,
  value,
  subtitle,
  borderColor = '#0F6E4F',
  onClick,
  className = '',
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      className={`app-kpi-card ${onClick ? 'app-kpi-clickable' : ''} ${className}`}
      style={{ '--kpi-border': borderColor }}
      onClick={onClick}
    >
      <div className="app-kpi-top">
        {Icon && (
          <div className="app-kpi-icon" style={{ background: iconBg }}>
            <Icon size={18} color={iconColor} />
          </div>
        )}
        {badge && (
          <span
            className="app-kpi-badge"
            style={{
              color: badgeColor || borderColor,
              background: badgeColor ? `${badgeColor}18` : `${borderColor}18`,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="app-kpi-value">{value}</div>
      {subtitle && <div className="app-kpi-sub">{subtitle}</div>}
    </Comp>
  );
}
