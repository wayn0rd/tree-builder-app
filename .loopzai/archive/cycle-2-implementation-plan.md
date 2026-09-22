<!-- implementation-plan.md — derived from spec.md sha256 cf5feec497c3ed98d5180ae2e8bc7c9028bcd9ce65682c83d5d387ec8d2c5148 (cycle 2, revision 2) -->

# Implementation plan — Cycle 2: Sector Watchlist, sector-header summary stats

This plan is guidance derived from the approved specification. Where any line
here disagrees with `.loopzai/spec.md` or `.loopzai/spec-amendments.md`, the
specification wins. The plan creates no frozen-test authority, adds no scope,
removes no commitment and changes no success criterion. Numbered criteria
below (1–14, E1, E2) are the specification's own numbering under "Success
criteria"; D1–D12 and M1–M3 are the specification's decisions and milestones.

## Provenance

- **Specification:** `.loopzai/spec.md`, sha256
  `cf5feec497c3ed98d5180ae2e8bc7c9028bcd9ce65682c83d5d387ec8d2c5148`,
  cycle 2, revision 2, approved 2026-09-21T22:54:11.872Z
  (`state.json.specificationApproval`; freeze commit `8a276cc`; revision
  record `.loopzai/spec-revisions/cycle-2-rev-2.md`, superseding revision 1
  `9c529598…68825` after the "freeze the promise, not the snapshot"
  durability revision).
- **Amendments read:** `.loopzai/spec-amendments.md` — header line only; no
  amendment exists for this cycle. `.loopzai/test-amendments.jsonl` is
  empty. `.loopzai/amendments.jsonl` carries one prior-cycle record
  (`assumption-0001`, cycle 1, approved: new frozen rows are authored by
  Verification, not Execution) — a harness convention this plan follows,
  not a product delta.
- **Planning dispatch:** `75b94709-4e88-467a-aa9c-5718bf27dc15`, base commit
  `2711221abc526eeb1074c67e4c989fa3214d0912` on `main`; tree snapshot clean
  except the untracked coordinator files `.loopzai/notifications.jsonl` and
  `.loopzai/spec-revisions/cycle-2-rev-1.md`. `git diff --name-only 44d5706
  HEAD -- . ':!.loopzai'` (Cycle 1 close → now) is empty: the product tree
  is exactly Cycle 1's verified tree.
- **Repository read:** `components/SectorCard.tsx`,
  `components/WatchlistBoard.tsx`, `components/TagFilterBar.tsx`,
  `components/StockForm.tsx` / `ManageStocksModal.tsx` / `SharePanel.tsx`
  (test-id inventory), `lib/quotes.ts`, `lib/useQuotes.ts`,
  `lib/watchlist.ts`, `app/page.tsx`, `app/shared/[token]/page.tsx`,
  `app/api/stock/route.ts`, `app/admin/page.tsx`, `app/layout.tsx`,
  `convex/testing.ts`, every file under `tests/` (12 files, with their
  freezing commits), `playwright.config.ts`, `package.json`,
  `tsconfig.json`, `next.config.js`, `.gitignore`, `README.md`,
  `.loopzai/verification-gates.json`, `.loopzai/milestones.json`, the
  archived Cycle 1 plan, verification report, manifest and execution log.
- **Environment facts that shape the mechanics below:**
  - `NODE_ENV=production` is set in the worker shell. Every prior gate run
    used `env -u NODE_ENV` for `npm run build` and `npm test`; this plan
    does the same (with `NODE_ENV=production`, `next dev` and
    devDependency resolution misbehave).
  - A Playwright spec **can** import a plain `lib/*.ts` module directly
    (checked in a throw-away `/tmp` project against this repo's
    `node_modules`: `import { summarizeSector } from '../lib/sectorSummary'`
    loads and every criterion-7 assertion passes, including
    `mean === 0.001` exactly and `String(45) === '45'`). The spec's
    uncertainty driver (1) is therefore retired provided the helper has no
    React / Next import — which D9 already requires.
  - `tsconfig.json` includes `**/*.ts`, so new test files are type-checked
    by `npx tsc --noEmit` and by `next build`; they must compile cleanly.
  - The spec's summary strings use MIDDLE DOT `U+00B7` (` · `), BLACK
    UP-POINTING TRIANGLE `U+25B2` (`▲`), BLACK DOWN-POINTING TRIANGLE
    `U+25BC` (`▼`) and, via `formatChange`, EM DASH `U+2014` (`—`).
    Execution renders exactly these code points; Verification's expected
    strings must be typed with the same ones.
  - Only `tests/cycle3-scoped.spec.ts` reads `LOOPZAI_CYCLE` (gated on the
    literal `'3'`). Setting `LOOPZAI_CYCLE=2` arms nothing that exists
    today.

## Module and file sequencing

Ordered as the milestones land. Each entry says what the change is for and
what must stay unchanged. Line counts are the specification's estimates.

1. **`lib/sectorSummary.ts` — M1 (new, ≈ 25 lines).** A pure,
   dependency-free module: no `'use client'` directive, no `import` of any
   kind, no `fetch`, no `process.env`, no React / Next / Convex reference
   (Architectural constraints: "importable outside React").
   - `export interface SectorSummary { mean: number | null; up: number;
     down: number; flat: number; unavailable: number }`.
   - `export function summarizeSector(values: ReadonlyArray<number | null>):
     SectorSummary` — one pass over `values`: `null` → `unavailable++`
     (never `0`, never in the denominator — D2); `> 0` → `up++`; `< 0` →
     `down++`; otherwise (`=== 0`) → `flat++` (D6, exact boundaries, no
     tolerance band); available values are summed and counted; `mean` is
     `sum / n` when `n > 0`, else `null` (D5: never `NaN`; `[]` and
     `[null, null]` both give `mean: null`). The mean is **unrounded** (D3;
     criterion 7 `[0.001, 0.001]` → `0.001`, `[1, 2, 4]` → `7/3` within
     `1e-9`).
   - No formatting, no direction classification, no DOM: those stay in
     `SectorCard.tsx` so the helper never imports a `'use client'` module.
   - Input domain is `number | null` as the spec states; `fetchQuote`
     already guarantees `changePercent` is a finite number or `null`
     (`typeof data.changePercent === 'number'`), so no extra guard is
     needed and none should reinterpret "unavailable".
2. **`components/SectorCard.tsx` — M2 (≈ +25 lines).** Header renders the
   summary; rows, ordering, colours and controls are untouched.
   - Import: `import { summarizeSector } from '../lib/sectorSummary';`
     (relative, like the existing `../lib/watchlist` import).
   - Derive the card's inputs with the **same expression the rows use** so
     header and rows can never disagree:
     `const summary = summarizeSector(sorted.map((s) => { const q =
     quotes[s.ticker]; return q ? q.changePercent : null; }));`
     — a missing quote, a failed quote (`UNAVAILABLE_QUOTE`) and a
     not-yet-fetched quote are all `null` (D8: no loading state).
   - Direction and text via the existing row rules (D3), built as **one
     string** and rendered as a single text node so JSX whitespace handling
     cannot insert or drop a space (uncertainty driver (2)):
     ```ts
     const summaryDirection = changeDirection(summary.mean);
     const summaryText =
       `${formatChange(summary.mean)} · ${summary.up}▲ ${summary.down}▼` +
       (summary.flat > 0 ? ` ${summary.flat} flat` : '') +
       (summary.unavailable > 0 ? ` ${summary.unavailable} n/a` : '');
     ```
     `formatChange(null)` already yields `—`, so an all-unavailable card
     reads `— · 0▲ 0▼ N n/a` (criterion 4, D5) with no `%` and no `NaN`.
     D7 falls out of the two conditionals.
   - Element, placed **inside the existing `<header>`**, between the `<h2>`
     tag title and the stock-count pill (D11):
     ```tsx
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
     ```
     React stringifies the integer props (`data-up="1"`), omits
     `data-mean` when `undefined` (criterion 4: attribute absent), and
     `String(45)` / `String(-10)` / `String(0)` give exactly `45`, `-10`,
     `0` (criteria 1–3). Treatment is the pill's own white-on-tag-colour
     style — no green / red class (D4).
   - Layout: to keep the summary immediately left of the pill and the header
     one line, wrap the summary and the pill in a right-hand group
     `<div className="flex shrink-0 items-center gap-2">…</div>` and leave
     the `<h2>` as the header's first child. The pill's markup and text
     (`{sorted.length} {sorted.length === 1 ? 'stock' : 'stocks'}`) are
     byte-identical (criterion 8). Do not change the `<h2>`; if a long tag
     wraps at 1280×720 with the fixture tags, the one permitted tweak is
     `min-w-0 truncate` on the `<h2>` (text unchanged).
   - **D10 — never** put `stock-row`, `stock-price`, `stock-change`,
     `edit-stock`, `delete-stock` or any `manage-stocks-*` test id on or
     inside the summary; the summary has exactly one `data-testid`
     (`sector-summary`). Page-wide counts of the row ids must remain what
     the rows produce (criterion 9).
   - The summary is a pure function of `stocks` and `quotes` props: it
     recomputes on every render the board already triggers (page load,
     Refresh prices, add / edit / delete, tag filter) and issues no request
     (criteria 10, 13). `WatchlistBoard`, `useQuotes`, `quotes.ts` and both
     pages are **not** edited; the shared page inherits the summary through
     the shared card (criterion 6).
3. **`README.md` — M3 (one or two sentences).** In the opening paragraph,
   after "…each showing live prices and daily % change — green up, red
   down." add e.g.: *Each sector card's header also carries a compact
   summary — the equal-weight mean of its rows' daily % change plus ▲ up /
   ▼ down counts (flat and n/a counts appear only when non-zero) —
   computed from the quotes already on the page, so the shared read-only
   view shows the same numbers.* The sentence must contain the words
   "summary" and "mean" (the static row keys on them); the literal
   `Manage Stocks` (line 9), `Company name` and the autofill wording
   (lines 24–29) stay untouched (criterion 14; frozen `AF-STATIC-23` and
   cycle-3 `T-S1`).
4. **Execution's own regression pass — M3.** On the tree after 1–3:
   `npx tsc --noEmit` → 0; stop any dev server, `env -u NODE_ENV npm run
   build` → 0 with the route set `/`, `/_not-found`, `/admin`,
   `/api/stock`, `/shared/[token]` (E2); `env -u NODE_ENV -u LOOPZAI_CYCLE
   npm test` → 0, expected `72 passed, 2 skipped` (criterion 11). Record the
   three results in the execution-log entry. Execution adds **no** file
   under `tests/` (assumption-0001 convention: Verification freezes the
   rows) and modifies none (E1). If `npx convex dev --once` is run for any
   reason and rewrites `convex/_generated/`, restore it
   (`git checkout -- convex/_generated`) before committing — E1 forbids any
   `convex/` change.

Not touched this cycle (Scope boundary): `app/api/**`, `convex/**`,
`package.json` / `package-lock.json`, `playwright.config.ts`,
`tests/**` (Execution), `components/WatchlistBoard.tsx`,
`components/TagFilterBar.tsx`, `lib/quotes.ts`, `lib/useQuotes.ts`,
`lib/watchlist.ts`, `app/page.tsx`, `app/shared/[token]/page.tsx`.

## Test plan

**Shared environment (identical to the frozen cycle-2/3 and autofill
harness):** Playwright config as committed (`workers: 1`, `retries: 0`,
`expect.timeout` 15 s, test timeout 240 s, `webServer: npm run dev` with
`NEXT_PUBLIC_E2E_TEST_MODE=1` on :3000, `reuseExistingServer: true`, global
warm-up navigation). Convex **dev** deployment from `.env.local`
(`NEXT_PUBLIC_CONVEX_URL`; refuse if it matches `frugal-anaconda-225`);
`SECRET = 'loopzai-e2e-dev-secret'`; `ADMIN = 'trixiematic415@gmail.com'`;
reset via `anyApi.testing.reset { secret }`; Node-client sign-in via
`anyApi.auth.signIn { provider: 'test-login', params: { email, secret } }`
then `client.setAuth(tokens.token)`; browser sign-in via the
`test-signin-email` / `test-signin-secret` / `test-signin-submit` form, then
wait for `manage-stocks-button` before any reload (cycle-3 amendment
precedent); viewport 1280×720. Run command for every durable row:
`env -u NODE_ENV -u LOOPZAI_CYCLE npm test`.

**Board fixture (spec "Success criteria" preamble), seeded through the Node
client as ADMIN in this order:** `AAPL` / `Apple` / `['Tech']`; `MSFT` /
`Microsoft` / `['Tech', 'Cloud']`; `NVDA` / `Nvidia` / `['Chips']`; `FAIL` /
`FailCo` / `['Chips']`. Cards render `Chips`, `Cloud`, `Tech`; rows
page-wide: 5.

**Quote stub, installed on every browser context (`ctx.route('**/api/stock*')`)
with a request counter `{ total, byTicker }`:** `AAPL` → `{ price: 200,
previousClose: 100, changePercent: 100 }`; `MSFT` → `{ 90, 100, -10 }`;
`NVDA` → `{ 100, 100, 0 }`; `TINY` → `{ 100.001, 100, 0.001 }` (used only
by the criterion-7 board leg); any other ticker (including `FAIL`) → HTTP 404
JSON `{ error }` (spec: "stub 404 → null"). Bodies carry
`ticker, price, previousClose, changePercent, historicalPrice` and no
`name`, so the Add-form autofill writes nothing.

**Helpers:** `card(page, tag) = page.locator('[data-testid="sector-card"][data-tag="<tag>"]')`;
`summary(page, tag) = card(page, tag).locator('header').getByTestId('sector-summary')`;
`row(page, ticker) = page.locator('[data-testid="stock-row"][data-ticker="<ticker>"]')`.
Expected strings are written with the code points named in Provenance;
`toHaveText(string)` normalises whitespace on both sides, so single spaces
are safe, but `·`, `▲`, `▼`, `—` must match exactly.

**New files (suggested names — `cycle2-` is taken by the pre-refresh
numbering, so this cycle uses a feature prefix as Cycle 1 did):**
- `tests/sector-summary-unit.spec.ts` — criterion 7 (direct helper calls).
- `tests/sector-summary-e2e.spec.ts` — criteria 1–6, 8–10, 13 (board +
  shared page), one serial describe, one long-lived ADMIN context plus one
  anonymous context.
- `tests/sector-summary-static.spec.ts` — criteria 13 (static leg) and 14.
- `tests/sector-summary-scoped.spec.ts` — E1, gated by
  `test.skip(process.env.LOOPZAI_CYCLE !== '2', 'cycle-2 scoped evidence')`
  so the plain suite reports it **skipped** (spec: cycle-scoped evidence
  must never redden a future run).
Criteria 11, 12 and E2 are graded by the Verification procedure, not by a
new file.

### Helper rows — `tests/sector-summary-unit.spec.ts`

`import { summarizeSector } from '../lib/sectorSummary';` — no browser, no
server. (If the runner ever rejected the import, the fallback is the
`TINY` board leg below plus criteria 1–4, which exercise every branch; the
`/tmp` check says it will not.)

| Row | Command / input | Pass criteria |
|---|---|---|
| **7a** | `summarizeSector([100, -10])` | `toEqual({ mean: 45, up: 1, down: 1, flat: 0, unavailable: 0 })`. |
| **7b** | `summarizeSector([0, null])` | `toEqual({ mean: 0, up: 0, down: 0, flat: 1, unavailable: 1 })`. |
| **7c** | `summarizeSector([null, null])` | `.mean === null`; `.unavailable === 2`; `up`, `down`, `flat` all `0`; `Number.isNaN(mean)` never true. |
| **7d** | `summarizeSector([])` | `toEqual({ mean: null, up: 0, down: 0, flat: 0, unavailable: 0 })`. |
| **7e** | `summarizeSector([1, 2, 4])` | `Math.abs(mean - 7 / 3) < 1e-9`; `up === 3`. |
| **7f** | `summarizeSector([0.001, 0.001])` | `mean === 0.001` (unrounded; `toBe(0.001)` holds exactly, `toBeCloseTo(0.001, 12)` is the tolerant form); `up === 2`. |
| **7g** (board leg, lives in the e2e file as its last row) | Node-client `stocks.add { ticker: 'TINY', name: 'Tiny', tags: ['Tiny'] }`, then click `refresh-prices` (a server-side add fetches no quote until a refresh) | `summary('Tiny')` text `+0.00% · 1▲ 0▼`; `data-direction="up"`; `data-mean="0.001"`. |

### Board rows — `tests/sector-summary-e2e.spec.ts`

`beforeAll`: reset; Node-client ADMIN sign-in; seed the fixture; ADMIN
browser context with stub + counter; sign in via the form; `await
expect(card('Tech')).toBeVisible()`; `waitForTimeout(2000)` so the
load-triggered fetches settle. Rows run in the order listed — 5 and 7g
mutate the fixture and therefore run last.

| Row | Command / input | Pass criteria |
|---|---|---|
| **1** | `summary(adminPage, 'Tech')` | `toHaveText('+45.00% · 1▲ 1▼')`; attributes `data-direction="up"`, `data-up="1"`, `data-down="1"`, `data-flat="0"`, `data-unavailable="0"`, `data-mean="45"`. |
| **2** | `summary(adminPage, 'Cloud')` | `toHaveText('-10.00% · 0▲ 1▼')`; `data-direction="down"`; `data-up="0"`, `data-down="1"`, `data-flat="0"`, `data-unavailable="0"`; `data-mean="-10"`. |
| **3** | `summary(adminPage, 'Chips')` | `toHaveText('0.00% · 0▲ 0▼ 1 flat 1 n/a')`; `data-direction="flat"`; `data-up="0"`, `data-down="0"`, `data-flat="1"`, `data-unavailable="1"`; `data-mean="0"`. |
| **8** | For each of `Tech`, `Cloud`, `Chips`: `h = card(page, tag).locator('header')` | `h.locator('h2')` `toHaveText(tag)`; `h.getByText(/^\d+ stocks?$/)` `toHaveText('2 stocks')` for Tech, `'1 stock'` for Cloud, `'2 stocks'` for Chips; `h.getByTestId('sector-summary')` `toHaveCount(1)`; `h` `toHaveCount(1)` (still one header element). |
| **9** | Page-wide counts on the owner board | `stock-row` 5; `stock-change` 5; `stock-price` 5; `edit-stock` 5; `delete-stock` 5; `sector-summary` 3; `page.locator('[data-testid="sector-summary"] [data-testid]')` 0 (nothing with a test id nests inside a summary). |
| **10** | `baseline = counter.total`; click `refresh-prices`; `expect.poll(() => counter.total, { timeout: 15_000 }).toBe(baseline + 4)`; `waitForTimeout(2000)`; per-ticker deltas; then click tag chip `Cloud`, then `clear-tag-filter` (cards hide/show → headers re-render); then `waitForTimeout(30_000)` | total is exactly `baseline + 4` after the refresh; each of `AAPL`, `MSFT`, `NVDA`, `FAIL` +1; total unchanged across the filter toggle and across the 30 s idle. |
| **13 (dynamic leg)** | Same counter, plus Node-client `stocks.update` on `FAIL` (row 4) and the Edit-form save (row 5) | counter unchanged by any header re-render; row 5's edit issues **zero** requests (`quotes['NVDA']` already present, and Edit never autofills). |
| **6** | Node-client `share.create {}` → `token`; new anonymous context with stub; `goto('/shared/' + token)`; `await expect(card(anon, 'Tech')).toBeVisible()` (auto-waits through the Convex cold read; cycle-3 T-E9 precedent) | `summary(anon, 'Tech')`, `'Cloud'`, `'Chips'` have the same text and the same `data-direction`, `data-up`, `data-down`, `data-flat`, `data-unavailable`, `data-mean` values as rows 1–3; `anon.getByTestId('edit-stock')` 0; `delete-stock` 0; `add-stock-button` 0; `sector-summary` 3. Close the context. |
| **4** | Node-client: `id = (await stocks.list).find(s => s.ticker === 'FAIL')._id`; `stocks.update { id, ticker: 'FAIL', name: 'FailCo', tags: ['Chips', 'Dead'] }` (the board updates reactively — no reload, no request) | `card('Dead')` visible; `summary('Dead')` `toHaveText('— · 0▲ 0▼ 1 n/a')`; `data-direction="unavailable"`; `data-up="0"`, `data-down="0"`, `data-flat="0"`, `data-unavailable="1"`; `await expect(summary('Dead')).not.toHaveAttribute('data-mean')` (attribute absent — also assert `getAttribute('data-mean') === null`); header `textContent` contains neither `NaN` nor `%`; `summary('Chips')` still as row 3. Restore: `stocks.update { …, tags: ['Chips'] }`; `card('Dead')` count 0. |
| **5** | `row(adminPage, 'NVDA').first().getByTestId('edit-stock').click()`; `stock-form` visible; `stock-form-tags` fill `Tech` + `Enter`; `stock-form-save`; **do not** click `refresh-prices` | `summary('Tech')` `toHaveText('+30.00% · 1▲ 1▼ 1 flat')`, `data-mean="30"`, `data-flat="1"`; counter unchanged. Then `card('Tech').locator(row('NVDA')).getByTestId('delete-stock').click()`; `confirm-delete`; `row('NVDA')` count 0 → `summary('Tech')` `toHaveText('+45.00% · 1▲ 1▼')`, `data-mean="45"`; bonus (same rule as 4): `summary('Chips')` now `'— · 0▲ 0▼ 1 n/a'` with no `data-mean`. |
| **7g** | as in the helper table (after row 5) | as stated there. |

### Static rows — `tests/sector-summary-static.spec.ts`

| Row | Command / input | Pass criteria |
|---|---|---|
| **13 (static leg)** | `fs.readFileSync('lib/sectorSummary.ts')`; `fs.readFileSync('components/SectorCard.tsx')` | helper source matches none of `/^\s*import\s/m`, `/require\(/`, `/\bfetch\(/`, `/process\.env/`, `/use client/`; card source matches none of `/\bfetch\(/`, `/from\s+['"]convex/`, `/useQuery|useMutation/`, `/from\s+['"]\.\.\/convex/` — every value the summary shows is derived from props. |
| **14** | `fs.readFileSync('README.md')` | `toContain('Manage Stocks')`; `toMatch(/summary/i)`; `toMatch(/\bmean\b/i)`. |

### Cycle-scoped evidence — `tests/sector-summary-scoped.spec.ts` (gated) and the procedure

| Row | Command / input | Pass criteria |
|---|---|---|
| **E1** (gated on `LOOPZAI_CYCLE === '2'`) | `BASE = '2711221abc526eeb1074c67e4c989fa3214d0912'`; `changed = git diff --name-only BASE -- . ':!.loopzai'` ∪ `git ls-files --others --exclude-standard -- . ':!.loopzai'`, minus `tests/sector-summary-*` | no entry starts with `convex/` (including `_generated/`), `app/api/`, or `tests/`; `package.json` and `package-lock.json` absent; `console.log('E1 CHANGED = …')` for the report. Expected set: `README.md`, `components/SectorCard.tsx`, `lib/sectorSummary.ts`. |
| **E2** (procedure) | the build log from the Verification procedure step 3 | route lines are exactly `/`, `/_not-found`, `/admin`, `/api/stock`, `/shared/[token]`. |

## Verification procedure

Graded end to end on **one tree**: the Execution head (commit C3 below) plus
the Verification freeze commit V0 that adds the new test files. Before
grading, `git status --porcelain -- . ':!.loopzai'` must be empty and
`git diff --name-only 2711221 HEAD -- tests/` must list only
`tests/sector-summary-*.spec.ts`.

0. **Prerequisites (read back, do not fix here — spec "Human actions"):**
   `.loopzai/verification-gates.json` still names `npx tsc --noEmit`,
   `npm run build`, `npm test` (reconciled; no change needed);
   `.env.local` has `CONVEX_DEPLOYMENT=dev:…` (not `frugal-anaconda-225`);
   `npx convex env get E2E_TEST_SECRET` prints `loopzai-e2e-dev-secret`;
   `node_modules/@playwright/test`, `node_modules/next` present; outbound
   HTTPS to `query1.finance.yahoo.com` answers 200 (needed only by the
   prior-cycle live rows `T-A*`, `AF-API-*`); `ss -ltnp | grep ':3000'` is
   empty or is `next dev` from the current tree with
   `NEXT_PUBLIC_E2E_TEST_MODE=1`. Run everything with `env -u NODE_ENV`.
1. **Typecheck (criterion 12a):** `npx tsc --noEmit` → exit 0 (covers the
   new helper, the card and the new test files).
2. **Build (criterion 12b, E2):** stop any dev server (`next build` and
   `next dev` share `.next/`), then `env -u NODE_ENV npm run build 2>&1 |
   tee /tmp/cycle2-a<N>-build.log` → exit 0; copy the route block into
   `verification.md` and compare with the E2 set.
3. **Full suite (criteria 1–11, 13, 14):** `env -u NODE_ENV -u LOOPZAI_CYCLE
   npm test 2>&1 | tee /tmp/cycle2-a<N>-suite.log` — Playwright starts the
   test-mode dev server itself. Never set `LOOPZAI_CYCLE=3` (V1's fence
   forbids `lib/`, which this cycle legitimately touches). Expected
   reporter summary: `72 + <new durable rows> passed`, `3 skipped`
   (cycle-3 V1, V2 and the gated E1), `0 failed`, `0 flaky`. Files run
   alphabetically: `api`, `autofill-*`, `cycle2-*`, `cycle3-*`,
   `sector-summary-*`. Budget ≈ 2 min for the existing 74 rows + ≈ 1.5 min
   for the new rows (one 30 s idle) + up to 2 min warm-up; live flake
   waits (3 × 30 s) on `T-A` / `AF-API` rows are the only variable.
4. **Cycle-scoped evidence (E1):** `LOOPZAI_CYCLE=2 env -u NODE_ENV npx
   playwright test tests/sector-summary-scoped.spec.ts` → 1 passed; paste
   the `E1 CHANGED` line. Confirm independently:
   `git diff --name-only 2711221 HEAD -- convex/ app/api/ package.json
   package-lock.json playwright.config.ts` is empty and
   `git diff --name-only 2711221 HEAD -- tests/ | grep -v '^tests/sector-summary-'`
   is empty.
5. **Frozen-file audit (criterion 11):** `git diff --stat V0 HEAD -- tests/`
   is empty at grading time; every prior-cycle file under `tests/` is
   byte-identical to its last frozen commit (`api` `6e6a540`,
   `autofill-api` `07fbe25`, `autofill-e2e`/`-static` `8c2c845`,
   `cycle2-api`/`-e2e`/`-functions` `a34572a`, `cycle2-static` `a7c89da`,
   `cycle3-e2e` `5fc93b1`, `cycle3-scoped` `5ab1cc4`, `cycle3-static`
   `f9e2ee6`, `global-setup` `d6b170a`).
6. **Independent spot checks (not machine-scored, cheap):** with the dev
   server up and a signed-in browser, a card header reads e.g.
   `+45.00% · 1▲ 1▼` in the same white pill style as `2 stocks`; the
   DevTools network panel shows no request on tag-filter toggles;
   `grep -c "data-testid=\"sector-summary\"" components/SectorCard.tsx` = 1;
   `grep -cE "stock-(row|price|change)|edit-stock|delete-stock|manage-stocks" lib/sectorSummary.ts` = 0.
7. **Verdict:** PASS only when steps 1–5 are all green. A red row is
   classified before any retry: a product defect → rework of the Execution
   files (never a test edit); a defect in a frozen row → the amendment
   path in "Frozen-row repair mechanics" (never a silent edit); a
   live-Yahoo failure the in-row flake rule already retried 3× →
   environmental, retry the whole attempt. Up to three attempts
   (`verification.maxAttempts`), ≈ 5–8 min each. Playwright `retries`
   stays 0.

## Git sequencing

Base: `2711221abc526eeb1074c67e4c989fa3214d0912` (planning dispatch base)
on `main`. Commit subjects follow the repository's existing pattern
(`loopzai cycle 1 M1: …`, `loopzai cycle 1 verification: …`). Every commit
must typecheck on its own (`npx tsc --noEmit`), touch no file under
`tests/`, `convex/`, `app/api/`, no `package*.json` and no
`playwright.config.ts`.

| # | Commit subject | Carries | Milestone |
|---|---|---|---|
| **C1** | `loopzai cycle 2 M1: lib/sectorSummary.ts — pure summarizeSector (equal-weight mean over available rows, exact up/down/flat/unavailable counts, null-safe)` | `lib/sectorSummary.ts`, `.loopzai/execution-log.md` (entry-0001) | M1 |
| **C2** | `loopzai cycle 2 M2: SectorCard header renders sector-summary (row-rule formatting and direction, neutral pill style, own test id and data attributes; owner board and shared page)` | `components/SectorCard.tsx`, `.loopzai/execution-log.md` (entry-0002) | M2 |
| **C3** | `loopzai cycle 2 M3: README header-summary sentence; tsc, build and existing Playwright suite green` | `README.md`, `.loopzai/execution-log.md` (entry-0003, recording `tsc` 0 / `build` 0 with the five routes / `npm test` 72 passed, 2 skipped) | M3 (Execution's part) |
| **V0** | `loopzai cycle 2 V0: freeze verification tests (sector-summary-unit, -e2e, -static, -scoped)` | the new files under `tests/` only | M3 (frozen rows) |
| **V1…** | `loopzai cycle 2 V<N>: verification attempt N — PASS/FAIL (…)` | `.loopzai/verification.md` only | — |

C1 is dead code until C2 and that is fine (it typechecks and changes no
behaviour). C1 and C2 may be squashed into one commit if Execution prefers
a single product commit; C3 stays separate so the README-only change is
revertable on its own. Coordinator-owned commits (plan promotion, milestone
status, interventions) interleave and are not Execution's. No tags, no
branches, no force-pushes; Execution and Verification never commit
`.loopzai/state.json`.

## Deploy, restart and rollback

No schema change, migration, environment variable, Convex function change,
route change or production restart is involved (Architectural constraints:
"purely derived, nothing persisted"). Runtime handoffs, how each is read
back, and how each is reversed:

1. **Test-mode dev server on :3000 (Verification; Feasibility census
   `runtimeHandoffs`).** Started by Playwright's `webServer` (`npm run dev`
   with `NEXT_PUBLIC_E2E_TEST_MODE=1`) when nothing listens; an existing
   server is reused, so restart it after any `npm run build` (shared
   `.next/`) and whenever the tree changes between attempts:
   `kill <pid>`; `env -u NODE_ENV NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev`.
   Read-back: `curl -s http://localhost:3000/ | grep -c test-signin` ≥ 1;
   a signed-in board shows `sector-summary` elements
   (`document.querySelectorAll('[data-testid="sector-summary"]').length`
   equals the card count). Reverse: stop it; `ss -ltnp | grep ':3000'`
   empty. `.next/` is gitignored; `rm -rf .next` is a safe reset if the
   server serves stale chunks.
2. **Convex dev deployment.** Unchanged by this cycle; reachable with
   `E2E_TEST_SECRET` set (README "One-time dev-deployment preparation").
   Nothing to deploy, nothing to reverse. If `npx convex dev --once` is
   run to confirm reachability, discard any rewrite of `convex/_generated/`
   before committing (E1).
3. **Production (manual `publishPolicy`, after close-out, when the owner
   chooses).** Frontend only: merge/push `main` → Vercel deploys. **No**
   `npx convex deploy` (nothing under `convex/` changed) and no ordering
   constraint between frontend and backend. Read-back on
   `https://www.sectorwatchlist.com`: sign in, every card header shows
   `<mean> · N▲ N▼` left of the `N stocks` pill; open a share link — the
   same headers; DevTools shows the same `/api/stock` requests as before
   (one per distinct ticker on load and on Refresh prices, none otherwise).
   Rollback: `git revert <C3> <C2> <C1>` (reverse order, or one
   `git revert --no-commit C1^..C3` + commit) and push → Vercel redeploys;
   the header returns to title + pill. No data was written by the feature,
   so nothing needs cleaning up; the shared page rolls back with the same
   deploy because it renders the same card.

## Frozen-row repair mechanics

- **Licensed amendments: none.** The specification's Feasibility census
  states `preApprovalFrozenTestAuthorities: []` and "This cycle reddens no
  frozen test row, so no `AUTHORIZE_TEST_AMENDMENT` is required". This
  plan therefore names no repair, **never creates or amends a frozen-test
  authority**, and neither Execution nor Verification may edit any file
  under `tests/` from a previous cycle, nor the new `sector-summary-*`
  files once V0 freezes them.
- **If a frozen row nonetheless reddens**, the only path is the harness's
  own: Verification reports the red row with evidence in
  `.loopzai/verification.md`; a human decides `AUTHORIZE_TEST_AMENDMENT`
  through the coordinator; the coordinator records it in
  `.loopzai/test-amendments.jsonl` and projects it into
  `.loopzai/spec-amendments.md` as an
  `## Amendment — frozen test <file>: <row> … (cycle 2, <timestamp>)` block
  carrying `<!-- loopzai-amendment kind="test" cycle="2" target-test="…" target-cycle="<origin cycle>" -->`,
  **Target test**, **Target cycle**, **Discovered in cycle**, **Evidence**
  and **Reason (human)**; a repair worker then edits only the named lines
  of the named row (precedents: `5fc93b1`, `5ab1cc4`, `07fbe25`), commits
  as `loopzai: cycle 2 — <row> test-harness repair: <what> (authorized amendment)`,
  and logs an execution-log entry naming the commit. A product-behaviour
  disagreement with a frozen row is never repaired in the test; it is a
  product defect (rework) or, if the row and the specification truly
  conflict, a return to Specification.
- **Rows this cycle could plausibly disturb, and the product-side answer
  the plan prefers over any amendment** (Execution should verify each
  before C3):
  - Page-wide and scoped counts of `stock-row`, `stock-change`,
    `edit-stock`, `delete-stock` (`cycle2-e2e` T-E1/E2/E4/E7/E8,
    `cycle3-e2e` incl. the modal-scoped `stock-change` count 0 and the
    shared-page `edit-stock` / `delete-stock` 0, `autofill-e2e`): D10 —
    the summary carries only `sector-summary`, nests no other test id, and
    `ManageStocksModal` does not render `SectorCard`, so no count moves.
  - `cycle2-e2e` T-E5 / T-E7 and `cycle3-e2e` request accounting: the
    summary issues no request; the +4 refresh delta and the 30 s idle
    window are unaffected.
  - `autofill-static` AF-STATIC-23 and `cycle3-static` T-S1 (README):
    the new sentence is additive; `Manage Stocks`, `Company name` and the
    autofill wording stay.
  - `cycle2-static` T-S1(b)/(c), T-S2: `SectorCard.tsx` and the helper
    mention neither `test-signin-`, the secret literal, nor
    `tickerWatchlist`.
  - `api.spec.ts` / `cycle2-api` / `autofill-api`: `/api/stock` is not
    touched.
  - `cycle3-scoped` V1/V2: must stay **skipped** — the durable run never
    sets `LOOPZAI_CYCLE`, and the E1 run sets it to `2`, not `3`.
