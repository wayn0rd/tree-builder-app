'use client';

// Manage Stocks modal — Cycle-3 spec .loopzai/spec.md:
// U2 (modal shell), U3 (rows), U5 (empty state), D4 (ticker sort),
// D9/D12 (dismissal, stacking, containment), D13 (hooks and labels).
//
// This component owns no mutation logic: Edit and Delete hand the stock back
// to the dashboard, which reuses its existing StockForm / delete-confirm
// state (D6). The overlay sits at z-30 so the reused child dialogs (z-40)
// render above it; DOM order in the dashboard also places it before them.
//
// Cycle 3 (CSV export / import, .loopzai/spec.md D1–D3, D13, D15): a toolbar
// row under the heading carries `Export CSV` (built in the browser from the
// loaded stocks — no request, no write) and `Import CSV` (a button plus a
// hidden file input). Neither adds a heading element nor the text
// `Add stock`, so the frozen Manage Stocks rows keep their shape.

import { useRef } from 'react';
import { Stock } from '../lib/watchlist';
import { EXPORT_FILENAME, serializeWatchlist } from '../lib/watchlistCsv';

interface ManageStocksModalProps {
  stocks: Stock[];
  onEdit: (stock: Stock) => void;
  onDelete: (stock: Stock) => void;
  onClose: () => void;
}

export default function ManageStocksModal({
  stocks,
  onEdit,
  onDelete,
  onClose,
}: ManageStocksModalProps) {
  // D4: same comparison the sector cards use, on the upper-cased ticker.
  const sorted = [...stocks].sort((a, b) => {
    const ta = a.ticker.toUpperCase();
    const tb = b.ticker.toUpperCase();
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // D2 / D3: the export is the stocks already on the page, serialised by
  // the pure codec (ticker-sorted, LF, no BOM) and handed to the browser as
  // a Blob download. Nothing is requested and nothing is written.
  function handleExport() {
    const csv = serializeWatchlist(stocks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = EXPORT_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // D13: the file input is cleared after every choice so the same file can
  // be chosen twice in a row. The import run itself is wired in M4.
  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
  }

  return (
    <div
      data-testid="manage-stocks-backdrop"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="manage-stocks-modal"
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Manage Stocks</h2>
          <button
            data-testid="manage-stocks-close"
            type="button"
            aria-label="Close Manage Stocks"
            title="Close"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        {/* Cycle 3 D1 / D15: toolbar row — no heading element, no
            `Add stock` text, no borrowed test id. */}
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-2">
          <button
            data-testid="manage-stocks-export"
            type="button"
            onClick={handleExport}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            data-testid="manage-stocks-import"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            data-testid="manage-stocks-import-file"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChosen}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          {sorted.length === 0 ? (
            <p
              data-testid="manage-stocks-empty"
              className="py-8 text-center text-sm text-gray-500"
            >
              No stocks yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sorted.map((stock) => (
                <li
                  key={stock.id}
                  data-testid="manage-stocks-row"
                  data-ticker={stock.ticker}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="w-20 shrink-0 font-bold text-gray-900">
                    {stock.ticker}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                    {stock.name}
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {stock.tags.map((tag) => (
                      <span
                        key={tag}
                        data-testid="manage-stocks-tag"
                        className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                  <button
                    data-testid="manage-stocks-edit"
                    type="button"
                    aria-label={`Edit ${stock.ticker}`}
                    title={`Edit ${stock.ticker}`}
                    onClick={() => onEdit(stock)}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    data-testid="manage-stocks-delete"
                    type="button"
                    aria-label={`Delete ${stock.ticker}`}
                    title={`Delete ${stock.ticker}`}
                    onClick={() => onDelete(stock)}
                    className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
