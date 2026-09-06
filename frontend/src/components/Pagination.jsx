// ─────────────────────────────────────────────────────────────
// src/components/Pagination.jsx — Reusable pagination controls
// ─────────────────────────────────────────────────────────────
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.ceil(total / limit) || 1;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  if (total <= limit) return null; // Don't show pagination if everything fits in one page

  return (
    <div className="pagination-controls">
      <span className="pagination-info">
        Showing {from}–{to} of {total}
      </span>
      <button
        className="btn btn-outline btn-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={14} /> Prev
      </button>
      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, textAlign: 'center' }}>
        {page} / {totalPages}
      </span>
      <button
        className="btn btn-outline btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next <ChevronRight size={14} />
      </button>
    </div>
  );
}
