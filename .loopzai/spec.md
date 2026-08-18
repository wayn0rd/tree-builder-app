<!-- spec.md — the frozen specification, once approved at the Specification gate. -->

# Cycle 1 Specification — Sector Watchlist (tree-builder-app pivot)

**Status:** awaiting spec-approval gate.
**Input:** `.loopzai/ideation.md` (frozen, cycle 1).
**One-line summary:** Replace the draggable node/connector tree UI with a
single-page, tag-driven, sector-card stock watchlist showing live Yahoo
Finance prices and daily % change, persisted in browser localStorage, with
a tag-filtered "custom chart page" reachable via URL query.

---

## 1. Decisions made here (open questions from ideation, now resolved)

These are commitments, not suggestions. A veto on any one of these can be
aimed at its number.

- **D1 — "24h % change" means change vs. previous regular-session close.**
  Computed as `((price − previousClose) / previousClose) × 100`, where
  `price` is Yahoo's `meta.regularMarketPrice` and `previousClose` is
  `meta.previousClose ?? meta.chartPreviousClose` from the same `range=1d`
  chart response. This matches what Yahoo/Google display as daily change.
  It is **not** a literal rolling-24-hour window (weekends/holidays show
  change vs. Friday's close). The UI label may say "24h" or "1D"; the
  frozen semantics are previous-close-based.
- **D2 — Refresh cadence: on page load + manual button. No auto-polling.**
  Prices fetch when the page loads and when the user clicks a
  "Refresh prices" button. A last-refreshed timestamp is displayed.
- **D3 — Storage: browser `localStorage`,** key `tickerWatchlist.v1`,
  schema in §3. No server-side or file-based persistence this cycle.
  localStorage survives a Vercel deploy (it is client-side) but is
  per-browser — acceptable for Wayne-only use this cycle; migrating the
  data to something shareable is explicitly future-cycle work (§6, R3).
- **D4 — "Custom chart page" = the main page filtered by tag selection,
  encoded in the URL.** Selecting tags updates the URL to
  `/?tags=<comma-joined, URI-encoded tag names>`; loading that URL
  restores the same filtered view. No separate route this cycle.
- **D5 — Tags are the only grouping mechanism.** There is no separate
  "sector" field. One card per tag; a stock with N tags appears on N
  cards. Every stock must have ≥ 1 tag (enforced by the form).
- **D6 — The existing `interval` parameter on `/api/stock` keeps working
  unchanged** (reuse-over-rebuild), but the new UI does not expose an
  interval selector this cycle.

## 2. API commitments — `GET /api/stock`

Extend the existing route at `app/api/stock/route.ts`. All existing
behavior (`ticker` required, `interval` optional, `price`,
`historicalPrice`) is preserved; new fields are added.

- **A1** — `GET /api/stock?ticker=<T>` returns HTTP 200 with JSON body
  containing at least:
  `{ ticker: string, price: number|null, previousClose: number|null, changePercent: number|null, historicalPrice: number|null }`
  for any ticker Yahoo recognizes.
- **A2** — `previousClose` is sourced per D1 (`meta.previousClose ??
  meta.chartPreviousClose ?? null`).
- **A3** — `changePercent = ((price − previousClose) / previousClose) × 100`,
  unrounded, and is `null` whenever `price` is null, `previousClose` is
  null, or `previousClose` is `0`.
- **A4** — Missing `ticker` param → HTTP 400 with JSON `{ error: string }`.
- **A5** — Ticker Yahoo returns no chart result for → HTTP 404 with JSON
  `{ error: string }`. Yahoo non-OK response → HTTP 502. Network/other
  failure → HTTP 500. All error bodies are JSON with an `error` string.
- **A6** — The route performs no filesystem writes and requires no API
  key or env var (Vercel-survivable, per ideation constraint).

## 3. Data model commitments (localStorage)

- **S1** — Key `tickerWatchlist.v1` holds JSON:
  `{ "version": 1, "stocks": [ { "id": string, "ticker": string, "name": string, "tags": string[] } ] }`
  `id` is any unique string; no ownership fields of any kind exist in the
  schema (no shares, equity, platform, cost basis — nothing from which a
  position could be inferred).
- **S2** — Validation, enforced by the add/edit form before save:
  - `ticker`: required; 1–10 chars matching `/^[A-Za-z0-9.^-]+$/`; stored
    uppercase. Adding a ticker that already exists in the watchlist
    (case-insensitive) is rejected with a visible error.
  - `name`: required, non-empty after trimming.
  - `tags`: at least 1; each tag trimmed, non-empty, and **must not
    contain a comma** (reserved for the URL encoding, D4); duplicate tags
    on one stock are deduplicated case-insensitively.
- **S3** — The watchlist survives a full page reload (write-through to
  localStorage on every add/edit/delete).
- **S4** — If the stored JSON is absent or unparseable, the app starts
  with an empty watchlist and does not crash.

## 4. UI commitments — page `/`

The root page no longer renders the tree canvas (§5). It renders, top to
bottom: header, controls (add + refresh + last-refreshed), tag filter bar,
and the sector-card grid.

Every element below commits to a `data-testid` attribute; these are part
of the frozen contract so Verification can write tests without seeing the
implementation.

- **U1 — Add/edit form** (`stock-form`): opened by `add-stock-button`;
  fields `stock-form-ticker`, `stock-form-name`, `stock-form-tags`
  (freeform multi-tag entry with suggestions drawn from tags already in
  the watchlist); save via `stock-form-save`; validation failures (§S2)
  surface a visible message in `stock-form-error` and do not save.
- **U2 — Edit and delete**: each stock row exposes `edit-stock`
  (reopens the form pre-filled; saving updates in place) and
  `delete-stock`; delete requires a confirmation step
  (`confirm-delete`) before the stock is removed.
- **U3 — Sector cards**: one card (`sector-card`, with attribute
  `data-tag="<tag>"`) per tag in the active view, each with a colored
  header showing the tag name and the count of its stocks. Cards are
  sorted case-insensitively ascending by tag name. A stock with multiple
  tags appears on every matching card.
- **U4 — Stock rows** (`stock-row`, attribute `data-ticker="<TICKER>"`),
  sorted ascending by ticker within a card, each showing:
  - ticker and company name;
  - `stock-price`: USD-formatted current price with 2 decimals and
    thousands separators (e.g. `$1,234.56`), or `—` when unavailable;
  - `stock-change`: signed percentage with 2 decimals (e.g. `+1.23%`,
    `-0.45%`), or `—` when unavailable, carrying attribute
    `data-direction` = `"up"` (changePercent > 0, rendered green),
    `"down"` (< 0, rendered red), `"flat"` (= 0, neutral), or
    `"unavailable"` (null/fetch failed, neutral). `data-direction` is the
    machine-verified criterion; the green/red rendering is
    human-checked at the gate.
- **U5 — Tag filter / custom chart page** (D4): a chip
  (`tag-chip`, attribute `data-tag`) per distinct tag in the watchlist;
  clicking toggles selection. With no chips selected, all tags' cards
  show. With ≥ 1 selected, only selected tags' cards show and the URL
  query reflects the selection per D4. Loading `/?tags=...` directly
  restores that selection. `clear-tag-filter` clears to the all-tags
  view and removes the query param.
- **U6 — Refresh** (D2): `refresh-prices` re-fetches all tickers;
  `last-refreshed` shows the time of the last completed fetch. A ticker
  whose fetch fails shows `—` / `data-direction="unavailable"` without
  breaking the rest of the page.
- **U7 — Empty state**: with zero stocks, the grid area shows
  `empty-state` containing a prompt to add a stock (no blank screen, no
  crash).

## 5. Replacement commitments (the pivot is clean)

- **P1** — `app/page.tsx` no longer imports or renders
  `components/TreeBuilder.tsx`; no draggable canvas, node, or connector
  UI is reachable anywhere in the app. `TreeBuilder.tsx` is deleted or
  left unreferenced by any app code.
- **P2** — `app/layout.tsx` metadata title is updated to
  `Sector Watchlist` (description updated to match; exact description
  wording is Execution's choice).
- **P3** — `npm run build` completes successfully (exit 0) — the
  Vercel-deployability floor.

## 6. Scope boundary — this cycle will NOT

- **N1** — Public deployment, Vercel setup, auth-less public routes, or
  any sharing mechanism (ideation defers this).
- **N2** — Any ownership/portfolio data or value rollups ("By Platform",
  "By Sector value") — permanently out per ideation, not just deferred.
- **N3** — Finnhub, as primary or fallback (future fallback only).
- **N4** — Auto-refresh / polling / websockets (D2 chose manual).
- **N5** — Interval selector UI (day/week/month/YTD/year) on the new
  page, price history charts, or sparklines. The API keeps the
  `interval` param (D6) but no UI drives it.
- **N6** — Import/export of the watchlist, multi-device sync, or any
  server-side storage.
- **N7** — Porting My Stocks' portfolio fields, sortable table, or
  anything beyond its modal-UX pattern as a visual reference.
- **N8** — Mobile-specific layout work beyond the grid reflowing to one
  column on narrow viewports.

## 7. Risks and rejected alternatives (one line each, veto-targetable)

**Risks**
- **R1** — Yahoo's unauthenticated chart API can rate-limit or change
  shape; this cycle accepts that risk (Finnhub fallback deferred, N3).
  Mitigation baked into A5: failures degrade to error JSON, and U6 keeps
  the page usable when a ticker fails.
- **R2** — `meta.previousClose` availability varies by quote type; D1's
  `?? chartPreviousClose` fallback covers the common case, and A3's
  null-handling covers the rest.
- **R3** — localStorage means the watchlist lives in one browser; the
  future sharing goal will require a storage migration (schema versioned
  as `v1` in S1 to make that migration explicit).
- **R4** — No test framework exists in the repo; Verification will need
  to add one (Playwright + a script for API checks), which is the
  largest single uncertainty in the estimate (§9).

**Rejected alternatives**
- Separate `/chart` route for the filtered view — rejected; query param
  on `/` (D4) is simpler and equally linkable.
- Computing 24h change from the existing `historicalPrice` (first close
  in range) — rejected; on `range=1d` that is today's first bar, not
  yesterday's close, and gives the wrong number.
- Rounding `changePercent` server-side — rejected; formatting is a UI
  concern (U4), API stays exact (A3).
- Allowing tag-less stocks in an "Untagged" card — rejected; requiring
  ≥ 1 tag (S2) keeps grouping total and the UI simpler.
- Auto-polling with a default interval — rejected per D2; trivial to add
  in a later cycle if Wayne asks.

## 8. Milestones (5 — fits one cycle; no split proposed)

1. **M1** — API: extend `/api/stock` with `previousClose` +
   `changePercent` (A1–A6).
2. **M2** — Data layer: localStorage model + add/edit/delete form with
   validation (S1–S4, U1, U2).
3. **M3** — Sector-card grid with live prices and change coloring
   (U3, U4, U6, U7).
4. **M4** — Tag filter + URL sync — the custom chart page (U5, D4).
5. **M5** — Pivot cleanup: remove TreeBuilder from the app, metadata,
   build passes (P1–P3).

## 9. Cost/time estimate (vetoable; 1.5× of the point estimates below is the cycle's breach threshold)

- **Scale of change:** ~1,200–1,800 lines added/changed across ~6–9
  files (one route extension, one rewritten page, 3–5 new components,
  storage module). Reference points: the canvas being replaced is 734
  lines; the My Stocks UX reference is 870.
- **Execution effort:** one Execution session, **point estimate 5
  agent-hours** (range 3–8). Wall clock through all gates: 1–2 days.
- **Spend:** **point estimate $60** total for the remainder of the cycle
  (Execution ≈ $35, Verification ≈ $25 including Playwright setup),
  range $35–90. **Breach thresholds: 7.5 agent-hours / $90.**
- **Uncertainty drivers, largest first:** (1) Playwright + test harness
  bring-up in a repo with zero test infrastructure (R4); (2) Yahoo
  flakiness forcing retries during live API tests (R1); (3) UI polish
  iteration on the card grid, which has no design mock beyond the
  infographic reference. The estimate is deliberately not optimistic:
  the happy path lands well under it; the thresholds absorb one bad
  surprise, not two.

---

## 10. Test plan — FROZEN with this spec

Rules of engagement: Verification implements these from this document
alone, may **add** checks, may never remove or weaken one. Tests T-A*
run against the real Yahoo API; tests T-U* MUST stub `/api/stock` (e.g.
Playwright route interception) so UI verdicts don't depend on market
state or Yahoo uptime. Setup for all tests: `npm install`, then
`npm run dev` (default port 3000) — or Playwright's `webServer`
equivalent. Verification may add dev-dependencies (Playwright, etc.) to
implement this plan.

**Float comparisons** use relative tolerance 1e-6 unless stated.
**Live-API flake rule:** if Yahoo itself returns non-200 during a T-A
test, retry up to 3 times with ≥ 30s between attempts; still failing
after that = test failure (that is signal, per R1).

### T-A: API (live, ticker `AAPL` unless stated)

- **T-A1** (A1): `curl -s "http://localhost:3000/api/stock?ticker=AAPL"`
  → HTTP 200; JSON with keys `ticker`, `price`, `previousClose`,
  `changePercent`, `historicalPrice`; `ticker === "AAPL"`; `price` and
  `previousClose` are numbers > 0.
- **T-A2** (A3): in the same response, `changePercent` equals
  `((price − previousClose) / previousClose) × 100` within tolerance.
- **T-A3** (A4): request with no `ticker` param → HTTP 400, JSON body
  with string `error`.
- **T-A4** (A5): `ticker=ZZZZZZZZ99` → HTTP status in {404, 502}, JSON
  body with string `error`. (Yahoo returns either not-found or an error
  page for garbage tickers; both are compliant.)
- **T-A5** (D6 regression): `ticker=AAPL&interval=year` → HTTP 200 and
  `historicalPrice` is a number (the pre-existing contract still works).
- **T-A6** (A6): `grep`/static check — `app/api/stock/route.ts` contains
  no `fs` import/usage and reads no `process.env` key.

### T-U: UI (Playwright, `/api/stock` stubbed)

Stub used throughout: `AAPL → {price: 200, previousClose: 100,
changePercent: 100}`, `MSFT → {price: 90, previousClose: 100,
changePercent: -10}`, `NVDA → {price: 100, previousClose: 100,
changePercent: 0}`, `FAIL → HTTP 502`. Selectors are the
`data-testid`/`data-*` attributes committed in §4 — their presence is
itself under test.

- **T-U1** (U1, S3): from an empty state, add AAPL (name "Apple", tags
  `Tech`) via `add-stock-button` → `stock-form` → `stock-form-save`.
  Pass: a `sector-card[data-tag="Tech"]` appears containing
  `stock-row[data-ticker="AAPL"]`. Reload the page. Pass: the card and
  row are still present (localStorage persistence).
- **T-U2** (S2): attempt to save a stock with (a) empty ticker, (b)
  empty name, (c) zero tags, (d) a tag containing a comma, (e) ticker
  `aapl` when AAPL already exists. Pass: in all five cases
  `stock-form-error` becomes visible and the watchlist's stock count is
  unchanged.
- **T-U3** (U4): with the stub, AAPL's `stock-price` text is `$200.00`;
  `stock-change` text is `+100.00%` with `data-direction="up"`; MSFT
  shows `-10.00%` / `data-direction="down"`; NVDA shows
  `data-direction="flat"`; a stock using ticker FAIL shows `—` for both
  price and change and `data-direction="unavailable"`, while the other
  rows still render (U6 isolation).
- **T-U4** (U3, D5): add MSFT with tags `Tech` and `Cloud`. Pass:
  `stock-row[data-ticker="MSFT"]` appears under **both**
  `sector-card[data-tag="Tech"]` and `sector-card[data-tag="Cloud"]`;
  cards appear in case-insensitive alphabetical order (`Cloud` before
  `Tech`); within the Tech card, AAPL precedes MSFT.
- **T-U5** (U5, D4): with tags `Tech` and `Cloud` present, click
  `tag-chip[data-tag="Cloud"]`. Pass: only the Cloud card is visible and
  the URL contains `tags=Cloud`. Then navigate directly to `/?tags=Cloud`
  in a fresh page. Pass: only the Cloud card is visible. Click
  `clear-tag-filter`. Pass: both cards visible, no `tags` param in URL.
- **T-U6** (U2): edit MSFT via `edit-stock`, change its name; pass: the
  row shows the new name. Delete MSFT via `delete-stock` →
  `confirm-delete`; pass: `stock-row[data-ticker="MSFT"]` is gone from
  all cards, and the `Cloud` card (now empty of stocks) is no longer
  shown. Reload; pass: still gone.
- **T-U7** (U7, S4): with localStorage cleared, page shows `empty-state`.
  With `tickerWatchlist.v1` set to the literal string `not json{`, the
  page loads without a console/page error and shows `empty-state`.
- **T-U8** (D2, U6): with the stub instrumented to count requests,
  clicking `refresh-prices` triggers exactly one new fetch per stored
  ticker, and `last-refreshed` text changes; over a 30-second idle wait
  with no interaction, **zero** additional `/api/stock` requests occur
  (no auto-polling).
- **T-U9** (P1): the page contains no element originating from
  `TreeBuilder` (no canvas/node/connector UI); static check:
  `app/page.tsx` does not import `TreeBuilder`, and no file under `app/`
  references it.

### T-B: Build

- **T-B1** (P3): `npm run build` exits 0.

### Human checks at the verification gate (not machine-scored, listed so they aren't skipped)

- **H1** (U4): up-changes render visibly green, down-changes visibly
  red, in the real browser.
- **H2** (U3): card headers are visibly colored bars in the spirit of
  the infographic reference.
- **H3** (N8): at a ~390px-wide viewport the grid reflows to a single
  column without horizontal scrolling.

*End of frozen test plan. 16 machine-scored tests (T-A1–6, T-U1–9,
T-B1), 3 human checks.*
