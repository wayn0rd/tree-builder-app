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
// Cycle 3 (CSV export / import, .loopzai/spec.md D1–D3, D10–D17): a toolbar
// row under the heading carries `Export CSV` (built in the browser from the
// loaded stocks — no request, no write) and `Import CSV` (a button plus a
// hidden file input). Choosing a file starts one identified preview run;
// only the current run may touch the panel, so a lookup result that
// arrives after Cancel, dismissal or a replacement file is dropped (D17).
// Confirming writes the added rows one at a time through the dashboard's
// `stocks.add` callback with dismissal locked (D11, D14). Nothing here adds
// a heading element or the text `Add stock`, so the frozen Manage Stocks
// rows keep their shape (D15).

import { useEffect, useRef, useState } from 'react';
import ImportCsvPanel, { ImportPanelState } from './ImportCsvPanel';
import { fetchCompanyName } from '../lib/quotes';
import { Stock } from '../lib/watchlist';
import { EXPORT_FILENAME, parseWatchlistCsv, serializeWatchlist } from '../lib/watchlistCsv';
import { planImport, resolveNames } from '../lib/watchlistImport';

interface ManageStocksModalProps {
  stocks: Stock[];
  onEdit: (stock: Stock) => void;
  onDelete: (stock: Stock) => void;
  onClose: () => void;
  /** One `stocks.add`; rejects with the server's own message. */
  onImportRow: (stock: Omit<Stock, 'id'>) => Promise<void>;
  /** One quote fetch per added ticker (D12). */
  onImported: (tickers: string[]) => void;
  /** D14 lock for the page-level Escape handler. */
  onImportingChange: (importing: boolean) => void;
}

export default function ManageStocksModal({
  stocks,
  onEdit,
  onDelete,
  onClose,
  onImportRow,
  onImported,
  onImportingChange,
}: ManageStocksModalProps) {
  // D4: same comparison the sector cards use, on the upper-cased ticker.
  const sorted = [...stocks].sort((a, b) => {
    const ta = a.ticker.toUpperCase();
    const tb = b.ticker.toUpperCase();
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  const [panel, setPanel] = useState<ImportPanelState | null>(null);
  // D17: identity of the current preview run. Every chosen file bumps it;
  // Cancel, dismissal and unmount bump it too, so a result from an older
  // run can never reach the panel.
  const runIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const applying = panel?.phase === 'applying';

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      onImportingChange(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // D13 / D17: an event handler (never an effect), so React StrictMode
  // cannot double-run it. The input is cleared so the same file can be
  // chosen twice in a row. Every chosen file starts its own run; every
  // update after an await is guarded by both the ref and the state's own
  // runId. Requests in flight are not aborted — they finish and are dropped.
  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const existing = stocks; // snapshot at choice time (D7: outcomes fixed at preview)
    const text = await file.text();
    if (runIdRef.current !== runId) return;
    const parsed = parseWatchlistCsv(text);
    if (parsed.error !== null) {
      setPanel({ runId, phase: 'preview', error: parsed.error, plan: [], pending: 0 });
      return;
    }
    const plan = planImport(parsed.rows, existing);
    const pendingTickers = new Set<string>();
    for (const r of plan) if (r.lookupPending) pendingTickers.add(r.ticker);
    const pending = pendingTickers.size;
    setPanel({ runId, phase: 'preview', error: null, plan, pending });
    if (pending === 0) return;
    const resolved = await resolveNames(plan, fetchCompanyName, (remaining) => {
      if (runIdRef.current !== runId) return; // stale progress: dropped
      setPanel((p) =>
        p && p.runId === runId && p.phase === 'preview' ? { ...p, pending: remaining } : p
      );
    });
    if (runIdRef.current !== runId) return; // stale result: dropped (D17)
    setPanel((p) =>
      p && p.runId === runId && p.phase === 'preview'
        ? { ...p, plan: resolved, pending: 0 }
        : p
    );
  }

  // D10: Cancel discards the preview, writes nothing, returns to the list.
  function handleCancel() {
    runIdRef.current += 1;
    setPanel(null);
  }

  // D11 / D12 / D14: sequential stocks.add in file order; a refusal marks
  // that row failed and the rest continue; nothing written is undone; a
  // skipped duplicate is never promoted when its claimant fails.
  async function handleConfirm() {
    const s = panel;
    if (!s || s.phase !== 'preview' || s.error !== null || s.pending > 0) return;
    const runId = s.runId;
    const plan = s.plan.map((r) => ({ ...r }));
    const targets = plan.filter((r) => r.outcome === 'added');
    if (targets.length === 0) return;
    onImportingChange(true);
    const added: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      setPanel({ runId, phase: 'applying', plan: [...plan], index: i + 1, total: targets.length });
      const r = targets[i];
      try {
        await onImportRow({ ticker: r.ticker, name: r.name ?? r.ticker, tags: r.tags });
        added.push(r.ticker);
      } catch (err) {
        r.outcome = 'failed';
        r.reason = err instanceof Error ? err.message : String(err);
      }
    }
    onImportingChange(false);
    onImported(added);
    setPanel({ runId, phase: 'report', plan: [...plan] });
  }

  function handleDone() {
    setPanel(null);
  }

  // D14: ✕ and the backdrop are inert while rows are being written.
  function requestClose() {
    if (applying) return;
    onClose();
  }

  return (
    <div
      data-testid="manage-stocks-backdrop"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
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
            onClick={requestClose}
            className="rounded-md px-2 py-1 text-lg leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        {/* Cycle 3 D1 / D15: toolbar row — no heading element, no
            `Add stock` text, no borrowed test id. Import stays available
            while a preview or report shows, not while writing. */}
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
            disabled={applying}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            data-testid="manage-stocks-import-file"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={applying}
            onChange={(e) => void handleFileChosen(e)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          {panel !== null ? (
            <ImportCsvPanel
              state={panel}
              onCancel={handleCancel}
              onConfirm={() => void handleConfirm()}
              onDone={handleDone}
            />
          ) : sorted.length === 0 ? (
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
