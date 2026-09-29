import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZES = [25, 50, 100];

// Page numbers with gaps, e.g. 1 … 4 5 [6] 7 8 … 15
function pageList(page, pages) {
  const shown = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...shown].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="pagination">
      <span className="muted">
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong>
      </span>
      <div className="pager">
        <button className="page-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        {pageList(page, pages).map((p) =>
          typeof p === 'string' ? (
            <span key={p} className="page-gap">…</span>
          ) : (
            <button
              key={p}
              className={p === page ? 'page-btn active' : 'page-btn'}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button className="page-btn" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
      <select className="filter-select page-size" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
        {PAGE_SIZES.map((n) => (
          <option key={n} value={n}>{n} per page</option>
        ))}
      </select>
    </div>
  );
}
