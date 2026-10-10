// ─────────────────────────────────────────────────────────────
// src/components/ui/TableSkeleton.jsx
// Shimmer loading placeholder for data tables
// ─────────────────────────────────────────────────────────────
import React from 'react';

export default function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="app-table-skeleton-row">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx}>
              <div
                className="skeleton"
                style={{
                  height: 14,
                  width: cIdx === 0 ? '70%' : cIdx === cols - 1 ? '40%' : '85%',
                  borderRadius: 4,
                  margin: cIdx === cols - 1 ? '0 0 0 auto' : '0',
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
