# Sector Watchlist — Pre-Cycle-2 Technical Brief
### (for outside review of the pending Cycle-2 spec)

> Context for the reviewer: this app is developed under **LoopzAI**, a loop-based
> autonomous build system. Each "cycle" runs Ideation → Specification → Execution
> → Verification. Cycle 1 is done and shipped. We are at the **Cycle-2
> specification approval gate** and want a second opinion before freezing the spec.
> This brief describes the app as it exists *today* (pre-Cycle-2), so the Cycle-2
> proposal can be evaluated against a real baseline.

---

## 1. What the app is

**Sector Watchlist** — a single-page stock-watchlist dashboard. Tickers are
grouped into **freeform, tag-based "sector" cards** (not a fixed taxonomy: you
invent tags like "Tech", "AI Infra", "Cloud"). Each card has a colored header and
lists its stocks with **live price + 24h % change**, green for up / red for down.
A stock with multiple tags appears on multiple cards (a stock on both "Tech" and
"Cloud" shows on both). Clicking tag chips filters the visible cards, and that
filter is mirrored into the URL (`/?tags=Tech,Cloud`) so a filtered view is a
shareable/bookmarkable link.

It began life as a draggable-canvas "Hierarchical Tree Builder"; Cycle 1 **pivoted
it entirely** into the watchlist (the tree UI was deleted, not extended).

## 2. Current architecture (Cycle 1, as-shipped)

**Stack:** Next.js 14 (App Router) + React 18 + TypeScript + Tailwind. No backend,
no database, no auth in Cycle 1.

| Layer | File | Role |
|---|---|---|
| Page (client) | `app/page.tsx` (248 ln) | Whole dashboard: state, quotes, filter, refresh. `'use client'`. |
| Quote API | `app/api/stock/route.ts` (76 ln) | Server route proxying Yahoo Finance `v8/finance/chart`. |
| Quote client | `lib/quotes.ts` (25 ln) | `fetchQuote` helper. |
| Data layer | `lib/watchlist.ts` (141 ln) | **localStorage** persistence + validation; `loadWatchlist`/`saveWatchlist`. |
| Card | `components/SectorCard.tsx` (150 ln) | One sector card, colored header, stock rows. |
| Form | `components/StockForm.tsx` (182 ln) | Add/edit stock; Enter-to-commit tag chips. |
| Filter bar | `components/TagFilterBar.tsx` (62 ln) | Tag chips + clear filter. |
| Tests | `tests/api.spec.ts` (122 ln), `tests/ui.spec.ts` (398 ln) | Playwright. |

**Scale:** ~1,400 lines of app code. Deps are minimal (no Convex, no auth lib yet).

## 3. Data & behavior contracts

- **Storage:** browser `localStorage` under key `tickerWatchlist.v1`. Per-browser
  only — **this is the core limitation Cycle 2 addresses.** No server persistence,
  no cross-device, no per-user anything.
- **Stock shape:** `{ ticker (uppercase), name, tags: string[] }`. **Deliberately
  no ownership/portfolio fields** (no shares/equity/cost-basis) so a shared view can
  never reveal position sizes.
- **Quotes:** Yahoo Finance via `/api/stock?ticker=X`. Returns `currentPrice`,
  `previousClose`, `changePercent` (unrounded). The route is **unauthenticated,
  no API key, no env vars, no filesystem** — dependency-light by design.
- **Refresh model:** **manual only.** Prices load on page-open + a refresh button;
  no polling, no websockets, no auto-refresh.
- **Validation:** ticker required (1–10 chars, charset-restricted, unique
  case-insensitively), name required, ≥1 tag, tags trimmed/comma-free/deduped.
- **UX details frozen in Cycle 1** (must be preserved): zero change renders
  unsigned `0.00%` with `data-direction="flat"`; `last-refreshed` shows 24h time
  with milliseconds; a `?tags=` value that no longer exists stays in the URL but
  matches no cards; failed quotes degrade per-row to `—` / `data-direction=
  "unavailable"` without breaking the rest.

## 4. Testing

- **6 API tests** (`api.spec.ts`, live Yahoo, with a flake-retry rule) — still
  valid, will keep passing unchanged.
- **10 UI tests** (`ui.spec.ts`) — localStorage-based; **cannot survive a login
  wall**, so Cycle 2 supersedes/replaces them (their behaviors are re-frozen in the
  new spec).
- 3 human visual checks were done at the Cycle-1 gate (up/down coloring, colored
  headers, mobile single-column reflow).

## 5. Ops / deployment status (as of today, done *outside* the loop)

- **Vercel:** repo connected, custom domain **www.sectorwatchlist.com** live,
  auto-deploys from `main`.
- **Convex:** a fresh prod deployment was provisioned for Cycle 2
  (`combative-minnow-928.convex.cloud`); `NEXT_PUBLIC_CONVEX_URL` is set in Vercel
  (prod/preview/dev). **No Convex code exists in the repo yet** — Cycle 2 adds it.
- **Google OAuth client:** not yet created; planned mid-Cycle-2 (its callback URL
  is only known once the auth code exists).

## 6. What Cycle 2 proposes to change (the thing under review)

One paragraph, so the baseline above is meaningful: move storage from
localStorage → **Convex** (per-user private watchlists), put **invite-only Google
OAuth** in front (admin-managed email whitelist, admin = a fixed email constant,
admin is *not* a super-reader of others' data), and add **tokenized, revocable,
no-login read-only share links** (`/shared/<token>`, whole-watchlist scope). No
anonymous mode; login becomes the front door. Cycle-1 UX and the `/api/stock`
contract are preserved verbatim. Out of scope: per-sector sharing, public sign-up,
data import, ownership fields, auto-refresh.

---

*Prepared for external review of the Cycle-2 specification. The spec itself is in
`.loopzai/spec.md` (repo: `wayn0rd/tree-builder-app`, private). This brief reflects
the actual shipped code as of 2026-08-24, not an aspirational description.*
