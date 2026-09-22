<!-- spec.md — Cycle 2 specification. Human contract; frozen on APPROVE_SPEC. -->

# Cycle 2 Specification — Sector Watchlist: sector-header summary stats

## Goal

Each sector card's header gains a compact, glanceable aggregate over the
rows on that card: the **equal-weight arithmetic mean** of the rows' daily
`changePercent`, followed by **counts** of rows that are up, down, flat and
unavailable. Today a card is a pile of tickers and the reader has to scan
every row to judge whether a sector is moving; after this cycle the header
answers that in one read (`+45.00% · 1▲ 1▼`). The numbers are derived purely
from the quotes the page already fetches — no new request, route, schema,
dependency or auth change — and the read-only shared page shows exactly the
same summary because it renders the same card. This is for the one owner
reading his private watchlist daily and for anyone he shares it with. It is
additive and reversible by revert.

## Behaviour changes

- Every sector card header (owner board and `/shared/<token>`) shows a
  summary element to the left of the existing `N stocks` pill: the mean of
  the card's rows' `changePercent`, then the direction counts.
- The mean is formatted by the same rule as a row's change: two decimals,
  `+` prefix when positive, `-` when negative, no sign when exactly zero
  (`+45.00%`, `-10.00%`, `0.00%`); `—` when no row on the card has a value.
- Rows whose quote is missing, failed, or not yet fetched are
  **unavailable**: excluded from the mean, never treated as `0`, never in the
  denominator, and reported in the unavailable count.
- Direction buckets are exact: **up** `changePercent > 0`, **down** `< 0`,
  **flat** exactly `0`, **unavailable** `null` / no quote.
- Visible text is `{mean} · {up}▲ {down}▼`, followed by ` {flat} flat` only
  when `flat > 0` and ` {unavailable} n/a` only when `unavailable > 0`
  (`0.00% · 0▲ 0▼ 1 flat 1 n/a`; `— · 0▲ 0▼ 2 n/a`).
- The summary recomputes whenever the card's quotes or rows change — page
  load, **Refresh prices**, add / edit / delete — with zero additional
  `/api/stock` requests.
- A ticker tagged into two sectors contributes to both cards' summaries.
- The summary is exposed to tooling as `data-testid="sector-summary"` with
  `data-direction` (`up` / `down` / `flat` / `unavailable`, from the
  unrounded mean), `data-up`, `data-down`, `data-flat`, `data-unavailable`
  (integers) and `data-mean` (the unrounded mean; attribute absent when the
  mean is unavailable).
- Nothing else changes: the header's tag title, the `1 stock` / `2 stocks`
  pill, row rendering and colours, ticker ordering, the tag filter and
  `?tags=` sync, the share flow, Manage Stocks, `/api/stock`, the manual
  refresh, schema and auth all behave exactly as before.

## Decisions

- **D1 — Equal-weight arithmetic mean.** Cap-weighting rejected for this
  cycle: the chart endpoint carries no `marketCap` and the endpoints that do
  now require a signed-in session (locked in ideation; see Scope boundary).
- **D2 — Unavailable rows are excluded from the mean**, never coerced to
  `0`, and reported in their own count. (Locked in ideation.)
- **D3 — Mean text and direction come from the unrounded mean via the row
  rules** (`formatChange` / `changeDirection` conventions). Consequence: a
  mean of `+0.004` renders `+0.00%` with direction `up`, and `-0.001`
  renders `-0.00%` with direction `down` — exactly what a row shows today
  for the same value. Alternative rejected: rounding before classifying,
  which would make the header disagree with its own rows.
- **D4 — No red / green colouring of the mean.** It renders in the same
  white-on-tag-colour style as the stock-count pill; direction is carried
  by the sign, the ▲ / ▼ counts and `data-direction`. Alternative rejected:
  reusing the rows' green / red text classes — on the HSL-coloured header
  background (40 % lightness) they fail contrast and read as mud.
- **D5 — All-unavailable card shows `—`** for the mean with
  `data-direction="unavailable"` and the counts still shown; never `NaN`,
  never `0.00%`. Alternative rejected: hiding the summary, which makes the
  header jump when the first quote lands.
- **D6 — Bucket boundaries are exact**: `> 0`, `< 0`, `=== 0`, `null`. No
  tolerance band around zero. Alternative rejected: treating `|x| < 0.005`
  as flat — it would classify a row as flat while the row itself renders a
  signed value.
- **D7 — Up and down counts always show; flat and n/a show only when
  non-zero.** `0▲ 0▼` is a meaningful "nothing moved" read; `0 flat 0 n/a`
  is noise on every card. Alternatives rejected: always four buckets
  (noise); only non-zero buckets (drops the `0▲ 0▼` signal).
- **D8 — "Not yet fetched" is unavailable; there is no separate loading
  state.** On first paint a card shows `— · 0▲ 0▼ N n/a` and updates as
  quotes arrive, mirroring the rows' `—`. Alternative rejected: hiding the
  summary until the first refresh completes (layout shift, extra state).
- **D9 — One pure, dependency-free helper in `lib/`**, `summarizeSector`,
  takes the card's `changePercent` values (`number | null` each) and returns
  `{ mean, up, down, flat, unavailable }`; the card calls it, so the owner
  board and the shared page cannot diverge. Alternative rejected: computing
  inline in the card — not checkable in isolation and easy to fork later.
- **D10 — The summary is a new element with its own test id and data
  attributes; it never reuses `stock-row`, `stock-price`, `stock-change`,
  `edit-stock`, `delete-stock` or any `manage-stocks-*` id.** Existing
  page-wide element counts on those ids must stay exactly what the rows
  produce. Alternative rejected: reusing `stock-change` + `data-direction`
  for the mean, which inflates row counts and reddens prior-cycle rows.
- **D11 — Placement is inside the existing header row**, between the tag
  title and the stock-count pill; the header stays one line. Alternative
  rejected: a second header line — taller cards, and ideation asked for
  "compact".
- **D12 — Counts are per card row, not per distinct ticker across the
  board.** MSFT tagged `Tech` and `Cloud` is one row on each card and counts
  on each. Alternative rejected: board-level dedup, which is a different
  feature (a board aggregate) and out of scope.

## Scope boundary

Explicitly NOT this cycle:

- **Market-capitalisation weighting.** Requires a new authenticated data
  source (`v10 quoteSummary` / `v7 quote` answer `401 / Invalid Crumb`
  without a session); deferred to a future cycle as its own feature.
- **Any other aggregate** — median, weighted by price, best / worst row,
  or a whole-board (all-sectors) summary.
- **Sort controls** (ideation D), **search / quick-filter** (B), **remember
  last filter** (C), **positions / P&L** (E), **CSV export / import** (F).
- **Colour treatment of the mean**, tooltips, legends, sparklines.
- **Automatic refresh** or any change to when quotes are fetched.
- **Any change to `/api/stock`**, the tag filter, `?tags=` behaviour, the
  share flow, Manage Stocks, the Add / Edit form, admin, auth, schema, or
  dependencies.
- **Quote-side dot-class handling** (`BRK.B` rows still `—`; unchanged from
  Cycle 1's boundary).
- **Modifying any file under `tests/` from a previous cycle**, or re-arming
  `tests/cycle3-scoped.spec.ts` under `LOOPZAI_CYCLE=3` (its fence forbids
  `lib/`, which this cycle legitimately touches).

## Human actions required

- **Before approval:** none. This cycle reddens no frozen test row, so no
  `AUTHORIZE_TEST_AMENDMENT` is required (census below). Two choices are
  the approver's to ratify or veto here rather than later: **D4** (no
  red / green on the mean) and **D7** (visible text format).
- **Before Verification runs (project owner):** the same prerequisites as
  Cycle 1, from README "One-time dev-deployment preparation" — `.env.local`
  pointing at the **dev** Convex deployment (never `frugal-anaconda-225`),
  `E2E_TEST_SECRET` set on that deployment, `node_modules` present, and
  outbound access to `query1.finance.yahoo.com` (needed only by the
  prior-cycle live-API rows; this cycle's own criteria run against the
  stub). `.loopzai/verification-gates.json` is already reconciled
  (`tsc` / `build` / `npm test`); no gate change is needed.
- **After the cycle closes:** production deployment is manual
  (`publishPolicy: manual`); deploy when you choose. No data migration, no
  environment variable, no restart.

## Success criteria

Board fixture (the stubbed `/api/stock` used by the frozen `T-E5` row):
`AAPL` +100 tagged `Tech`; `MSFT` −10 tagged `Tech`, `Cloud`; `NVDA` 0
tagged `Chips`; `FAIL` (stub 404 → `null`) tagged `Chips`. "Summary" means
the `sector-summary` element inside that card's `sector-card` header.

1. `Tech` summary text is exactly `+45.00% · 1▲ 1▼`; `data-direction="up"`,
   `data-up="1"`, `data-down="1"`, `data-flat="0"`, `data-unavailable="0"`,
   `data-mean="45"`.
2. `Cloud` summary text is `-10.00% · 0▲ 1▼`; `data-direction="down"`,
   `data-mean="-10"`.
3. `Chips` summary text is `0.00% · 0▲ 0▼ 1 flat 1 n/a`;
   `data-direction="flat"`, `data-flat="1"`, `data-unavailable="1"`,
   `data-mean="0"`.
4. A card whose rows are all unavailable (e.g. `FAIL` alone under a tag
   `Dead`) shows `— · 0▲ 0▼ 1 n/a`; `data-direction="unavailable"`; the
   `data-mean` attribute is absent; the header text contains no `NaN` and no
   `%`.
5. After adding `NVDA` to `Tech` via the Add / Edit form, the `Tech` summary
   reads `+30.00% · 1▲ 1▼ 1 flat` without clicking **Refresh prices**; after
   deleting it again the summary returns to `+45.00% · 1▲ 1▼`.
6. `/shared/<token>` for the same watchlist shows, for the same cards,
   identical summary text and semantic attribute values for identical card
   data to criteria 1–3, with no edit / delete controls.
7. Direct calls to the helper: `summarizeSector([100, -10])` →
   `{ mean: 45, up: 1, down: 1, flat: 0, unavailable: 0 }`;
   `summarizeSector([0, null])` → `{ mean: 0, up: 0, down: 0, flat: 1,
   unavailable: 1 }`; `summarizeSector([null, null])` → `mean: null`,
   `unavailable: 2`; `summarizeSector([])` → `mean: null`, every count `0`;
   `summarizeSector([1, 2, 4])` → `mean` within `1e-9` of `7/3`;
   `summarizeSector([0.001, 0.001])` → `mean: 0.001` (sic: unrounded), which
   the header renders as `+0.00%` with `data-direction="up"`.
8. Every card header still contains the tag title and the stock-count pill
   with unchanged text (`Tech` → `2 stocks`, `Cloud` → `1 stock`); the
   summary sits inside the same `header` element as both.
9. On the fixture board the page-wide count of `stock-change` elements
   equals the count of `stock-row` elements (5, since `MSFT` is on two
   cards), and the page-wide counts of `stock-price`, `edit-stock` and
   `delete-stock` are likewise unchanged by the header.
10. The manual refresh still issues exactly one `/api/stock` request per
    distinct ticker and none during a 30-second idle; no request is issued
    by rendering or re-rendering a header.
Criteria 11–14 are **durable contracts**: promises about the product that
must stay true after this cycle, whatever later cycles legitimately add.
Standing rule: *freeze the promise, not the snapshot.*

11. **Prior frozen verification remains green.** `npm test` on the dev
    deployment: every frozen verification row from a previous cycle that
    was green before this cycle is still green after it; rows fenced to
    another cycle (today `tests/cycle3-scoped.spec.ts`) still report
    **skipped**.
12. **The project typechecks and builds.** `npx tsc --noEmit` exits 0 and
    `npm run build` exits 0.
13. **The sector summary adds no new request or persistence dependency.**
    Rendering or re-rendering a summary issues no HTTP request and reads or
    writes nothing through Convex; every value it shows is derived from the
    quotes and rows the card already holds. Existing behaviour remains
    compatible: every element, text and interaction that criteria 8–10 name
    behaves exactly as before the summary existed.
14. `README.md` describes the header summary in one or two sentences and
    still contains the literal `Manage Stocks`.

The following are **cycle-scoped evidence**: exact inventories that prove
*this cycle's* diff stayed inside its scope boundary, checked once at Cycle 2
close. They are not part of the durable contract. Verification may use
exactness to prove this cycle's own scope, but must not freeze these current
inventories as forever-closed sets — a future cycle that legitimately adds a
route, a dependency, a Convex function or a test file must not turn Cycle 2's
frozen verification red.

- **E1.** Cycle 2's diff touches no file under `convex/` or `app/api/`, adds,
  removes or changes no `package.json` dependency, and modifies no
  previously frozen file under `tests/`.
- **E2.** At Cycle 2 close, `npm run build` reports the same route set as
  today (`/`, `/_not-found`, `/admin`, `/api/stock`, `/shared/[token]`).

## Architectural constraints

- **Purely derived, nothing persisted.** The summary is computed at render
  from quotes already in memory; no data path, route, schema or Convex
  function changes. Rollback is a revert of two source files and a README
  line, with no migration and no redeploy ordering.
- **Both pages share one card**, so the shared page inherits the summary
  automatically — and inherits any defect in it. There is no way to ship
  the owner view without the shared view.
- **Test-id collision is the real regression risk (D10).** Prior-cycle
  rows count `stock-row`, `stock-change`, `edit-stock` and `delete-stock`
  page-wide on both the board and the shared page; a header that borrows
  any of those ids reddens frozen rows from Cycles 1–3 and sends the cycle
  back here to declare authorities.
- **The helper must be importable outside React** (no `'use client'`, no
  React / Next import) so it can be exercised directly. Cycle 1's only
  in-process import from a spec (`next/server`) caused a system halt; a
  dependency-free module avoids that class of failure.
- **The header's colour background constrains the design (D4).** Anything
  placed there must be legible on an arbitrary `hsl(h, 62%, 40%)`; only
  white / translucent-white treatments are safe.
- **Rounding is visible.** The mean is taken over unrounded row values and
  rounded once for display, so a reader averaging the *displayed* row
  percentages by hand may land 0.01 off; this is correct, not a bug.
- **Cross-card double counting is by design (D12).** A ticker in two
  sectors moves both sectors' means; a board-level aggregate would need a
  different rule and is not this cycle.
- **`tests/cycle3-scoped.spec.ts` V1** forbids `lib/` in its diff fence and
  is skipped unless `LOOPZAI_CYCLE=3`; it must stay un-armed.
- Performance is O(rows) per card per render; at watchlist scale it is
  unmeasurable.

## Cost / time

- **Effort:** small — the smallest cycle so far. One new module
  `lib/sectorSummary.ts` (≈ 25 lines), `components/SectorCard.tsx` header
  (≈ +25 lines), one README sentence. Execution: about 45–90 minutes wall
  clock. Verification: rows derived from criteria 1–14 (board rows on the
  existing stub fixture plus direct helper calls); the full serial
  Playwright run is currently ≈ 2 minutes for 74 rows plus up to 2 minutes
  of dev-server warm-up, so ≈ 5–8 minutes per attempt, up to three attempts.
- **Expected spend: $12** (range $7–20). Execution ≈ $6; Verification
  ≈ $3 per attempt, two attempts expected. The breach threshold is
  therefore **$18**. Calibration note: Cycle 1 estimated $18 but the
  harness recorded `costUsd: 0`, so there is no measured actual to anchor
  on; this estimate is scaled from Cycle 1's by surface area (two files
  and no route work versus three files and a route change).
- **Uncertainty drivers:** (1) no spec in this repo yet imports a `lib/`
  TypeScript module directly — if the runner rejects it, the helper
  criteria fall back to board-only evidence and cost a second attempt;
  (2) exact-text matching of `▲`, `▼`, `·` and the spaces between tokens
  under Playwright's whitespace normalisation — a false red here means a
  re-authored row, not a product fix; (3) Next dev-server first-compile
  latency timing out an attempt; (4) a second execution pass if the header
  inflates a row-scoped count (D10) or renders `NaN` on an all-unavailable
  card (D5).

## Feasibility census
feasibility: PASS
preApprovalFrozenTestAuthorities: []
runtimeHandoffs:
- dev server on :3000 with NEXT_PUBLIC_E2E_TEST_MODE=1 and the dev Convex deployment reachable during Verification
architecturalBlockers: none
unresolvedHumanDecisions: none
scopeExplosion: none

## Milestones

- **M1** — Pure `summarizeSector` helper in `lib/`: equal-weight mean over available rows, four exact direction counts, null-safe (never `NaN`)
- **M2** — Sector card header renders the summary (row-rule formatting, neutral treatment, own test id and data attributes) on the owner board and the shared page
- **M3** — Existing Playwright suite green, `tsc` and `build` exit 0, README sentence
