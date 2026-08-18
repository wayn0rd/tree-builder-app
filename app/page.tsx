'use client';

// Sector Watchlist — spec .loopzai/spec.md §4 (U1–U7), D2 (manual refresh),
// D4 (?tags= URL sync), D5 (tags are the only grouping).

import { useEffect, useRef, useState } from 'react';
import StockForm from '../components/StockForm';
import SectorCard from '../components/SectorCard';
import TagFilterBar from '../components/TagFilterBar';
import { Quote, fetchQuote } from '../lib/quotes';
import {
  Stock,
  distinctTags,
  loadWatchlist,
  makeId,
  saveWatchlist,
} from '../lib/watchlist';

function formatRefreshTime(date: Date): string {
  // Millisecond precision so consecutive refreshes always change the text
  // (see .loopzai/assumptions.md assumption-0003).
  const time = date.toLocaleTimeString('en-US', { hour12: false });
  return `${time}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export default function Home() {
  // null = not yet loaded from localStorage (avoids hydration mismatch and
  // a flash of empty-state before the client-side read).
  const [stocks, setStocks] = useState<Stock[] | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote | undefined>>({});
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Stock | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Stock | null>(null);
  const didInit = useRef(false);

  async function refreshQuotes(tickers: string[]) {
    setRefreshing(true);
    await Promise.all(
      tickers.map(async (ticker) => {
        const quote = await fetchQuote(ticker);
        setQuotes((prev) => ({ ...prev, [ticker]: quote }));
      })
    );
    setLastRefreshed(new Date());
    setRefreshing(false);
  }

  // D2: fetch on page load only (plus the manual button) — no polling.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const loaded = loadWatchlist();
    setStocks(loaded);
    const tagsParam = new URLSearchParams(window.location.search).get('tags');
    if (tagsParam) {
      setSelectedTags(
        tagsParam
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }
    if (loaded.length > 0) {
      refreshQuotes(loaded.map((s) => s.ticker));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** S3: write-through to localStorage on every mutation. */
  function updateStocks(next: Stock[]) {
    setStocks(next);
    saveWatchlist(next);
  }

  function handleSave(data: Omit<Stock, 'id'>) {
    if (!stocks) return;
    const next = editing
      ? stocks.map((s) => (s.id === editing.id ? { ...s, ...data } : s))
      : [...stocks, { id: makeId(), ...data }];
    updateStocks(next);
    setFormOpen(false);
    setEditing(null);
    if (!quotes[data.ticker]) {
      fetchQuote(data.ticker).then((quote) =>
        setQuotes((prev) => ({ ...prev, [data.ticker]: quote }))
      );
    }
  }

  function handleConfirmDelete() {
    if (!stocks || !pendingDelete) return;
    updateStocks(stocks.filter((s) => s.id !== pendingDelete.id));
    setPendingDelete(null);
  }

  /** D4: selection ↔ /?tags=<comma-joined, URI-encoded tag names>. */
  function applySelection(next: string[]) {
    setSelectedTags(next);
    const url =
      next.length > 0
        ? `${window.location.pathname}?tags=${next
            .map(encodeURIComponent)
            .join(',')}`
        : window.location.pathname;
    window.history.replaceState(null, '', url);
  }

  function toggleTag(tag: string) {
    const lower = tag.toLowerCase();
    const isSelected = selectedTags.some((t) => t.toLowerCase() === lower);
    applySelection(
      isSelected
        ? selectedTags.filter((t) => t.toLowerCase() !== lower)
        : [...selectedTags, tag]
    );
  }

  const allTags = stocks ? distinctTags(stocks) : [];
  const selectedLower = new Set(selectedTags.map((t) => t.toLowerCase()));
  const visibleTags =
    selectedTags.length === 0
      ? allTags
      : allTags.filter((t) => selectedLower.has(t.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Sector Watchlist</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span data-testid="last-refreshed" className="text-xs text-gray-500">
              {lastRefreshed
                ? `Last refreshed: ${formatRefreshTime(lastRefreshed)}`
                : 'Not refreshed yet'}
            </span>
            <button
              data-testid="refresh-prices"
              type="button"
              onClick={() => stocks && refreshQuotes(stocks.map((s) => s.ticker))}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh prices'}
            </button>
            <button
              data-testid="add-stock-button"
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add stock
            </button>
          </div>
        </header>

        <TagFilterBar
          tags={allTags}
          selected={selectedTags}
          onToggle={toggleTag}
          onClear={() => applySelection([])}
        />

        {stocks && stocks.length === 0 ? (
          <div
            data-testid="empty-state"
            className="rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-16 text-center"
          >
            <p className="mb-1 text-lg font-medium text-gray-700">
              Your watchlist is empty
            </p>
            <p className="text-sm text-gray-500">
              Click “+ Add stock” to add your first ticker.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stocks &&
              visibleTags.map((tag) => (
                <SectorCard
                  key={tag}
                  tag={tag}
                  stocks={stocks.filter((s) =>
                    s.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
                  )}
                  quotes={quotes}
                  onEdit={(stock) => {
                    setEditing(stock);
                    setFormOpen(true);
                  }}
                  onDelete={(stock) => setPendingDelete(stock)}
                />
              ))}
          </div>
        )}

        {formOpen && stocks && (
          <StockForm
            initial={editing}
            stocks={stocks}
            onSave={handleSave}
            onClose={() => {
              setFormOpen(false);
              setEditing(null);
            }}
          />
        )}

        {pendingDelete && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setPendingDelete(null);
            }}
          >
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
              <p className="mb-4 text-sm text-gray-800">
                Delete <span className="font-semibold">{pendingDelete.ticker}</span>{' '}
                ({pendingDelete.name}) from the watchlist?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  data-testid="confirm-delete"
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
