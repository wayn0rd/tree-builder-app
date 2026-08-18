// Watchlist data layer — localStorage persistence + validation.
// Spec: .loopzai/spec.md §3 (S1–S4).

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  tags: string[];
}

export interface Watchlist {
  version: 1;
  stocks: Stock[];
}

export const STORAGE_KEY = 'tickerWatchlist.v1';

export const TICKER_RE = /^[A-Za-z0-9.^-]+$/;

/**
 * S4: absent or unparseable stored JSON → empty watchlist, never a crash.
 * Malformed entries are dropped silently (no console noise — T-U7 requires
 * a clean console on corrupt storage).
 */
export function loadWatchlist(): Stock[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.stocks)) {
      return [];
    }
    return parsed.stocks.filter(
      (s: unknown): s is Stock =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as Stock).id === 'string' &&
        typeof (s as Stock).ticker === 'string' &&
        typeof (s as Stock).name === 'string' &&
        Array.isArray((s as Stock).tags) &&
        (s as Stock).tags.every((t) => typeof t === 'string')
    );
  } catch {
    return [];
  }
}

/** S1/S3: write-through persistence of the versioned schema. */
export function saveWatchlist(stocks: Stock[]): void {
  if (typeof window === 'undefined') return;
  try {
    const data: Watchlist = { version: 1, stocks };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full/unavailable: the in-memory list still works this session.
  }
}

export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface StockInput {
  ticker: string;
  name: string;
  /** Raw candidate tags (chips + any pending text), pre-validation. */
  tags: string[];
}

export type ValidationResult =
  | { ok: true; stock: Omit<Stock, 'id'> }
  | { ok: false; error: string };

/**
 * S2 validation. `editingId` excludes the stock being edited from the
 * duplicate-ticker check.
 */
export function validateStock(
  input: StockInput,
  existing: Stock[],
  editingId: string | null
): ValidationResult {
  const ticker = input.ticker.trim().toUpperCase();
  if (ticker.length < 1 || ticker.length > 10 || !TICKER_RE.test(ticker)) {
    return {
      ok: false,
      error:
        'Ticker is required: 1–10 characters, letters/digits/. ^ - only.',
    };
  }
  const duplicate = existing.some(
    (s) => s.id !== editingId && s.ticker.toUpperCase() === ticker
  );
  if (duplicate) {
    return { ok: false, error: `${ticker} is already in the watchlist.` };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: 'Company name is required.' };
  }

  // Tags: trimmed, non-empty, comma-free, deduplicated case-insensitively.
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.tags) {
    const tag = raw.trim();
    if (!tag) continue;
    if (tag.includes(',')) {
      return { ok: false, error: 'Tags may not contain commas.' };
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length === 0) {
    return { ok: false, error: 'At least one tag is required.' };
  }

  return { ok: true, stock: { ticker, name, tags } };
}

/** Distinct tags across the watchlist, case-insensitively deduped (first
 *  spelling wins), sorted case-insensitively ascending. */
export function distinctTags(stocks: Stock[]): string[] {
  const seen = new Map<string, string>();
  for (const s of stocks) {
    for (const tag of s.tags) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0
  );
}
