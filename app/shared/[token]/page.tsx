'use client';

// Read-only shared watchlist page — spec D8/U6/F7: no login required, no
// sign-in redirect. Renders the same visual board as the owner view
// (cards, prices, tag filter with ?tags= sync, manual refresh) with ALL
// mutating controls absent. Unknown/revoked token → `share-invalid`.

import { useQuery } from 'convex/react';
import { useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { api } from '../../../convex/_generated/api';
import WatchlistBoard from '../../../components/WatchlistBoard';
import { Stock } from '../../../lib/watchlist';
import { formatRefreshTime, useQuotes } from '../../../lib/useQuotes';

export default function SharedPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';
  const data = useQuery(api.share.get, { token });

  const { quotes, lastRefreshed, refreshing, refreshAll } = useQuotes();
  const didInitQuotes = useRef(false);

  // F7 payload has no ids; synthesize row keys from tickers (unique
  // per-user, S4).
  const stocks: Stock[] | null = data
    ? data.stocks.map((s) => ({
        id: s.ticker,
        ticker: s.ticker,
        name: s.name,
        tags: s.tags,
      }))
    : null;

  // D8: quotes on page load + manual refresh only — same as the owner view.
  useEffect(() => {
    if (stocks === null || didInitQuotes.current) return;
    didInitQuotes.current = true;
    if (stocks.length > 0) {
      void refreshAll(stocks.map((s) => s.ticker));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (data === null) {
    // D8: unknown or revoked token — polite screen, no watchlist data.
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <div
          data-testid="share-invalid"
          className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm"
        >
          <h1 className="mb-2 text-xl font-bold text-gray-900">
            Link not found or revoked
          </h1>
          <p className="text-sm text-gray-500">
            This share link doesn&rsquo;t exist anymore. Ask the person who
            shared it for a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Sector Watchlist
            </h1>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
              Shared · read-only
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span data-testid="last-refreshed" className="text-xs text-gray-500">
              {lastRefreshed
                ? `Last refreshed: ${formatRefreshTime(lastRefreshed)}`
                : 'Not refreshed yet'}
            </span>
            <button
              data-testid="refresh-prices"
              type="button"
              onClick={() =>
                stocks && void refreshAll(stocks.map((s) => s.ticker))
              }
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh prices'}
            </button>
          </div>
        </header>

        <WatchlistBoard stocks={stocks ?? []} quotes={quotes} />
      </main>
    </div>
  );
}
