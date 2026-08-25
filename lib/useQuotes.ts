'use client';

// Quote state shared by the owner dashboard and the read-only shared page —
// spec D11/U6 (same formatting, manual refresh only) and D8.

import { useState } from 'react';
import { Quote, fetchQuote } from './quotes';

export function formatRefreshTime(date: Date): string {
  // 24h time with millisecond precision so consecutive refreshes always
  // change the text (Cycle-1 parity, D11).
  const time = date.toLocaleTimeString('en-US', { hour12: false });
  return `${time}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export function useQuotes() {
  const [quotes, setQuotes] = useState<Record<string, Quote | undefined>>({});
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Manual/page-load refresh: one request per distinct ticker (D11). */
  async function refreshAll(tickers: string[]) {
    setRefreshing(true);
    const distinct = Array.from(new Set(tickers));
    await Promise.all(
      distinct.map(async (ticker) => {
        const quote = await fetchQuote(ticker);
        setQuotes((prev) => ({ ...prev, [ticker]: quote }));
      })
    );
    setLastRefreshed(new Date());
    setRefreshing(false);
  }

  /** Fetch a single ticker (after add/edit) without touching last-refreshed. */
  async function fetchOne(ticker: string) {
    const quote = await fetchQuote(ticker);
    setQuotes((prev) => ({ ...prev, [ticker]: quote }));
  }

  return { quotes, lastRefreshed, refreshing, refreshAll, fetchOne };
}
