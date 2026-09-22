'use client';

// One sector card per tag — spec U3 (colored header, stock count) and
// U4 (rows sorted by ticker, price/change formatting, data-direction).

import { Stock } from '../lib/watchlist';
import { Quote } from '../lib/quotes';
import { summarizeSector } from '../lib/sectorSummary';

export type Direction = 'up' | 'down' | 'flat' | 'unavailable';

export function changeDirection(changePercent: number | null): Direction {
  if (changePercent == null) return 'unavailable';
  if (changePercent > 0) return 'up';
  if (changePercent < 0) return 'down';
  return 'flat';
}

/** U4: USD, 2 decimals, thousands separators; "—" when unavailable. */
export function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** U4: signed percentage with 2 decimals; "—" when unavailable. */
export function formatChange(changePercent: number | null): string {
  if (changePercent == null) return '—';
  const sign = changePercent > 0 ? '+' : '';
  return `${sign}${changePercent.toFixed(2)}%`;
}

/** Stable per-tag header color (H2: visibly colored bars). */
export function tagColor(tag: string): string {
  let hash = 0;
  const lower = tag.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    hash = (hash * 31 + lower.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 62%, 40%)`;
}

const DIRECTION_CLASS: Record<Direction, string> = {
  up: 'text-green-600',
  down: 'text-red-600',
  flat: 'text-gray-500',
  unavailable: 'text-gray-400',
};

interface SectorCardProps {
  tag: string;
  stocks: Stock[];
  quotes: Record<string, Quote | undefined>;
  /** Omit both handlers for the read-only shared page (U6/D8: no
   *  edit-stock/delete-stock buttons render at all). */
  onEdit?: (stock: Stock) => void;
  onDelete?: (stock: Stock) => void;
}

export default function SectorCard({
  tag,
  stocks,
  quotes,
  onEdit,
  onDelete,
}: SectorCardProps) {
  const sorted = [...stocks].sort((a, b) =>
    a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0
  );

  // Cycle 2 header summary (D9): same per-row expression the rows use, so
  // a missing, failed or not-yet-fetched quote is `null` (D8) for both.
  const summary = summarizeSector(
    sorted.map((s) => {
      const q = quotes[s.ticker];
      return q ? q.changePercent : null;
    })
  );
  // D3: text and direction from the unrounded mean via the row rules.
  // D7: up/down always shown; flat and n/a only when non-zero. Built as one
  // string so JSX whitespace handling cannot alter the spacing.
  const summaryDirection = changeDirection(summary.mean);
  const summaryText =
    `${formatChange(summary.mean)} · ${summary.up}▲ ${summary.down}▼` +
    (summary.flat > 0 ? ` ${summary.flat} flat` : '') +
    (summary.unavailable > 0 ? ` ${summary.unavailable} n/a` : '');

  return (
    <section
      data-testid="sector-card"
      data-tag={tag}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <header
        className="flex items-center justify-between px-4 py-2.5 text-white"
        style={{ backgroundColor: tagColor(tag) }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide">{tag}</h2>
        <div className="flex shrink-0 items-center gap-2">
          {/* D4/D10/D11: neutral white pill, own test id, no row id reused. */}
          <span
            data-testid="sector-summary"
            data-direction={summaryDirection}
            data-up={summary.up}
            data-down={summary.down}
            data-flat={summary.flat}
            data-unavailable={summary.unavailable}
            data-mean={summary.mean == null ? undefined : String(summary.mean)}
            className="whitespace-nowrap rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium tabular-nums"
          >
            {summaryText}
          </span>
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium">
            {sorted.length} {sorted.length === 1 ? 'stock' : 'stocks'}
          </span>
        </div>
      </header>
      <ul className="divide-y divide-gray-100">
        {sorted.map((stock) => {
          const quote = quotes[stock.ticker];
          const changePercent = quote ? quote.changePercent : null;
          const direction = changeDirection(changePercent);
          return (
            <li
              key={stock.id}
              data-testid="stock-row"
              data-ticker={stock.ticker}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">
                  {stock.ticker}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {stock.name}
                </div>
              </div>
              <div className="text-right">
                <div
                  data-testid="stock-price"
                  className="text-sm font-medium tabular-nums text-gray-900"
                >
                  {formatPrice(quote ? quote.price : null)}
                </div>
                <div
                  data-testid="stock-change"
                  data-direction={direction}
                  className={`text-xs font-medium tabular-nums ${DIRECTION_CLASS[direction]}`}
                >
                  {formatChange(changePercent)}
                </div>
              </div>
              {(onEdit || onDelete) && (
                <div className="flex flex-col gap-1">
                  {onEdit && (
                    <button
                      data-testid="edit-stock"
                      type="button"
                      onClick={() => onEdit(stock)}
                      aria-label={`Edit ${stock.ticker}`}
                      title="Edit"
                      className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      ✎
                    </button>
                  )}
                  {onDelete && (
                    <button
                      data-testid="delete-stock"
                      type="button"
                      onClick={() => onDelete(stock)}
                      aria-label={`Delete ${stock.ticker}`}
                      title="Delete"
                      className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      🗑
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
