<!-- implementation-plan.md — derived from spec.md sha256 2c268850af4bc073b2ebc8a41fd41b7ee1e1135ac7a60e8ac69f2b5c42453d70 (cycle 1, revision 1) -->

# Implementation plan — Cycle 1: Add-stock Company name autofill from the ticker

This plan is guidance derived from the approved specification. Where any line
here disagrees with `.loopzai/spec.md` or `.loopzai/spec-amendments.md`, the
specification wins. The plan creates no frozen-test authority, adds no scope,
removes no commitment and changes no success criterion. Numbered criteria
below (1–23) are the specification's own numbering under "Success criteria";
D1–D10 and M1–M4 are the specification's decisions and milestones.

## Provenance

- **Specification:** `.loopzai/spec.md`, sha256
  `2c268850af4bc073b2ebc8a41fd41b7ee1e1135ac7a60e8ac69f2b5c42453d70`,
  cycle 1, revision 1, approved 2026-09-21T07:48:37.306Z
  (`state.json.specificationApproval`; revision record
  `.loopzai/spec-revisions/cycle-1-rev-1.md`).
- **Amendments read:** `.loopzai/spec-amendments.md` — header line only; no
  amendment exists for this cycle. `.loopzai/test-amendments.jsonl` and
  `.loopzai/amendments.jsonl` are empty.
- **Planning dispatch:** `5a5108a2-1fd6-4ca9-ae58-b069b0fafcdc`, base commit
  `f78266b7944a2fa7ddac3f87cd3ab572c2e18dae`, tree snapshot clean except the
  untracked coordinator file `.loopzai/notifications.jsonl`.
- **Repository read:** `app/api/stock/route.ts`, `lib/quotes.ts`,
  `lib/useQuotes.ts`, `lib/watchlist.ts`, `components/StockForm.tsx`,
  `components/WatchlistBoard.tsx`, `components/ManageStocksModal.tsx`,
  `app/page.tsx`, `convex/stocks.ts`, `convex/lib/validate.ts`,
  `convex/testing.ts`, `convex/schema.ts`, every file under `tests/`,
  `playwright.config.ts`, `package.json`, `tsconfig.json`, `next.config.js`,
  `README.md`, `.gitignore`, `.loopzai/verification-gates.json`,
  `.loopzai/milestones.json`, and the archived cycle-3 execution log,
  verification report and amendments (via `git show c18bb54:…`).
- **Toolchain observed:** Node v24.20.0, `next` 14.2.35, `@playwright/test`
  1.62.1, `typescript` 5.x; `node_modules` and `.env.local` (dev deployment,
  `E2E_TEST_SECRET` line present) exist on this machine. Baseline
  `npx tsc --noEmit --incremental false` exits 0 on `f78266b`.
- **Live fixture probe (2026-09-21, `query1.finance.yahoo.com`, range=1d):**
  `AAPL` 200 longName "Apple Inc." / shortName "Apple Inc."; `^GSPC` 200
  "S&P 500" / "S&P 500"; `BRK-B` 200 longName "Berkshire Hathaway Inc." /
  shortName "Berkshire Hathaway Inc. New"; `BRK.B` **404**; `ZZZZZZZZ99`
  **404**. Criteria 1–3 and 5 are therefore satisfiable against live Yahoo
  today, and `BRK.B` still maps to the route's existing 502 branch.
- **Harness probe:** in plain Node, `require('next/server')` yields a
  `NextRequest` whose `nextUrl.searchParams` parses `?ticker=X` and a
  `NextResponse.json()` that round-trips its body — the mechanism criterion 4
  relies on (Test plan, row 4).
- **Existing suite census** (`test(` per file): `api.spec.ts` 6,
  `cycle2-api` 1, `cycle2-e2e` 9, `cycle2-functions` 14, `cycle2-static` 3,
  `cycle3-e2e` 14, `cycle3-static` 1, `cycle3-scoped` 2 (skipped without
  `LOOPZAI_CYCLE=3`) — 50 rows, 48 expected to pass and 2 to skip.
- **Who writes the new rows:** per harness practice (cycle 3 commit
  `f9e2ee6` "verification: freeze test implementation … implemented before
  reading execution-log.md or the implementation diff") the frozen rows for
  criteria 1–19 and 23 are authored by the Verification worker from the
  Test plan below. Execution does **not** add files under `tests/`.

## Module and file sequencing

Ordered as the milestones land. Each entry says what the change is for and
what must stay unchanged. Line counts are the specification's estimates.

1. **`app/api/stock/route.ts` — M1 (≈ +5 lines).** In the 200 branch, after
   `historicalPrice` is computed and before `NextResponse.json({...})`, derive
   `name` from `meta` and add it as one more key of the 200 body:
   - `name` = `meta.longName` when it is a non-empty string; else
     `meta.shortName` when it is a non-empty string; else `null`. (Spec D4:
     longName → shortName → null. Treating an empty string like an absent
     value is a plan-level mechanic that stays inside "else"; the form side
     also guards blank names, see 3.)
   - Every existing key of the 200 body keeps its value and order; `name` is
     appended last so the byte layout of existing keys is unchanged.
   - The 400, 404, 502 and 500 branches are not touched — same statuses,
     same `{ error: <string> }` bodies, no `name` key (criterion 5).
   - No new import; still no `fs`, still no `process.env` (criterion 6,
     frozen T-A6). `next: { revalidate: 0 }` stays (no caching).
2. **`lib/quotes.ts` — M2 (≈ +30 lines).** Add
   `export async function fetchCompanyName(ticker: string): Promise<string | null>`
   beside `fetchQuote`. `Quote`, `UNAVAILABLE_QUOTE` and `fetchQuote` stay
   byte-identical (the manual refresh, `useQuotes`, the shared page and the
   two frozen quote stubs depend on them — criterion 21).
   - Internal helper `requestName(t)`: `fetch('/api/stock?ticker=' +
     encodeURIComponent(t))`; non-`ok` → `{ ok: false, name: null }`;
     `ok` → parse JSON and return `{ ok: true, name }` where `name` is
     `data.name` if it is a non-empty string, else `null`; any thrown error
     (network failure, bad JSON) → `{ ok: false, name: null }`.
   - `fetchCompanyName(t)`: `first = await requestName(t)`; if `first.ok`
     **or** `t` contains no `.` → return `first.name` (a 200 with
     `name: null` returns null with no second request — criterion 10).
     Otherwise exactly one retry: `requestName(t.replace(/\./g, '-'))` and
     return its `name` (D3; `BRK.B` → `BRK-B`). A network failure on a
     dot-class ticker counts as "does not return 200" and retries once.
   - The caller passes the already-normalized ticker; this function never
     normalizes and never throws.
3. **`components/StockForm.tsx` — M2 + M3 (≈ +40 lines).** Wire the blur
   lookup and the write rules; nothing else in the form changes.
   - Imports: add `useEffect`, `useRef` to the React import; import
     `fetchCompanyName` from `../lib/quotes`.
   - **Provenance as its own fact (D2).** Hold the name and its provenance
     together so a write reads both atomically at write time:
     `const [nameState, setNameState] = useState<{ value: string; fromAutofill: boolean }>({ value: initial?.name ?? '', fromAutofill: false })`
     and `const name = nameState.value;` so the existing `validateStock({ ticker, name, … })`
     call and `<input value={name}>` lines stay as they are. The name
     input's `onChange` becomes
     `setNameState({ value: e.target.value, fromAutofill: false })` — every
     keystroke, including clearing, makes the text human-authored for the
     life of the form (criteria 12, 14, 15). (An equivalent implementation
     with a separate boolean state plus refs is acceptable provided the
     write-time read is of the *current* values, never of values captured
     when the lookup started.)
   - **Ticker mirror for the stale guard (D7).** `const tickerRef = useRef(ticker)`;
     the ticker input's `onChange` sets both `setTicker(v)` and
     `tickerRef.current = v`. The ticker's text is never rewritten (D9,
     criterion 8) — no `toUpperCase` on the field.
   - **Unmount guard.** `const mountedRef = useRef(false)` set true in a
     `useEffect` on mount and false in its cleanup; a response arriving after
     Cancel/Save (the dashboard unmounts the form) is dropped.
   - **Blur handler** on the ticker `<input>`:
     `onBlur={(e) => void handleTickerBlur(e.currentTarget.value)}` with
     ```
     async function handleTickerBlur(raw: string) {
       if (initial) return;                                  // D5: Add only (criterion 18)
       const requested = raw.trim().toUpperCase();           // D9 normalization (criterion 8)
       if (!requested) return;                               // D8: blank ticker → no request (criterion 9)
       const found = await fetchCompanyName(requested);      // D3 retry lives inside
       if (!mountedRef.current) return;
       if (found === null) return;                           // D6: a miss never writes (criteria 11, 16)
       if (tickerRef.current.trim().toUpperCase() !== requested) return; // D7: current value at write time (criterion 17)
       setNameState((prev) =>
         prev.value.trim() === '' || prev.fromAutofill        // D2 write rule (criteria 7, 12–15)
           ? { value: found, fromAutofill: true }
           : prev
       );
     }
     ```
     "Blank" for the name means `value.trim() === ''`, the same definition
     D8 gives for a blank ticker and the one `validateStock` applies. A
     human-cleared (blank) field is writable again (D8's rationale); a
     human-retyped field is not (criterion 15).
   - **No new UI (D10):** no spinner, hint, toast, error text, `disabled`
     on Save, or `setError` on a miss. `handleSubmit`, the tag logic, the
     Cancel/Save buttons, test ids and class names are untouched.
   - Every blur with a non-blank ticker issues a lookup (D8) — no
     "unchanged since last lookup" short-circuit.
4. **`README.md` — M4.** One or two sentences describing the autofill,
   placed in the intro paragraph or beside the "Quotes proxied from Yahoo
   Finance via `/api/stock`" bullet. Keep the literal `Manage Stocks`
   (frozen T-S1, criterion 23). So that the criterion-23 row can grade it
   mechanically, the sentence should contain the literal `Company name` and
   the word `auto-fills` (or `autofill`), e.g.: "In the Add stock form,
   leaving the ticker field auto-fills the Company name from the same
   Yahoo lookup that powers quotes (`AAPL` → Apple Inc.); a name you typed
   yourself is never overwritten, and a lookup that misses changes nothing."
5. **`.loopzai/execution-log.md` — Execution's checkpoint entries** in the
   archived format (`### entry-NNNN` + yaml block with `timestamp`, `phase`,
   `cycle`, `status`, `commitSha`, `filesTouched`, then one paragraph).
6. **Deliberately untouched:** `lib/useQuotes.ts`, `app/page.tsx`,
   `app/shared/[token]/page.tsx`, `components/*` other than `StockForm.tsx`,
   `convex/**` (no schema, function, or validation change — `stocks.add`
   and `Company name is required.` stay as they are, criterion 19),
   `playwright.config.ts`, `package.json`/`package-lock.json` (no new
   dependency), every existing file under `tests/` (criterion 20),
   `.loopzai/verification-gates.json` (human-owned reconciliation).

Execution's own check of each criterion is ad hoc (curl against the dev
server; a scratch Playwright script kept outside `tests/` and not
committed), recorded in the execution log — it must not pre-author files
under `tests/` that would collide with the Verification freeze.

## Test plan

**Shared environment (identical to the frozen cycle-2/3 harness):** Playwright
config as committed (`workers: 1`, `retries: 0`, `expect.timeout` 15 s, test
timeout 240 s, `webServer: npm run dev` with `NEXT_PUBLIC_E2E_TEST_MODE=1` on
:3000, `reuseExistingServer: true`, global warm-up navigation). Convex
**dev** deployment from `.env.local` (`NEXT_PUBLIC_CONVEX_URL`; refuse if it
matches `frugal-anaconda-225`); `SECRET = 'loopzai-e2e-dev-secret'`;
`ADMIN = 'trixiematic415@gmail.com'`; reset via
`anyApi.testing.reset { secret }`; Node-client sign-in via
`anyApi.auth.signIn { provider: 'test-login', params: { email, secret } }`
then `client.setAuth(tokens.token)`; browser sign-in via the
`test-signin-email` / `test-signin-secret` / `test-signin-submit` form;
viewport 1280×720. `BASE = 'http://localhost:3000'`. Run command for every
row: `env -u NODE_ENV npm test` (whole `tests/` directory; never set
`LOOPZAI_CYCLE`).

**New files (suggested names; `cycleN-` is avoided because `cycle2-`/`cycle3-`
already exist from the pre-refresh numbering):**
- `tests/autofill-api.spec.ts` — rows 1–5 (live route + route-handler harness).
- `tests/autofill-e2e.spec.ts` — rows 7–19 (stubbed `/api/stock`, one serial
  describe, one long-lived ADMIN context).
- `tests/autofill-static.spec.ts` — rows 6 and 23.
Rows 20–22 are graded by the Verification procedure, not by a new file; row
21 is graded by the frozen cycle-2 T-E5 row.

### Route rows (live Yahoo) — `tests/autofill-api.spec.ts`

Reuse `getWithFlakeRetry` from `tests/api.spec.ts` verbatim (copy, do not
import from a frozen file): on 502/500, retry up to 3× with a 30 s wait, for
rows that expect 200.

| Row | Command / input | Pass criteria |
|---|---|---|
| **1** | `request.get(BASE + '/api/stock?ticker=AAPL')` via flake retry | status 200; body has keys `ticker`, `price`, `previousClose`, `changePercent`, `historicalPrice` **and** `name`; `body.name === 'Apple Inc.'`; `body.ticker === 'AAPL'`; `typeof body.price === 'number'`. |
| **2** | `…/api/stock?ticker=%5EGSPC` via flake retry | status 200; `body.name === 'S&P 500'`. |
| **3** | `…/api/stock?ticker=BRK-B` via flake retry | status 200; `body.name === 'Berkshire Hathaway Inc.'` (not `'Berkshire Hathaway Inc. New'` — proves longName preference). |
| **4** | Route-handler harness, no network: `import { GET } from '../app/api/stock/route'; import { NextRequest } from 'next/server';` save `globalThis.fetch`, replace it with `async () => new Response(JSON.stringify(FIXTURE), { status: 200, headers: { 'content-type': 'application/json' } })`, call `await GET(new NextRequest('http://localhost:3000/api/stock?ticker=NONAME'))`, restore `fetch` in `finally`. FIXTURE = `{ chart: { result: [{ meta: { symbol: 'NONAME', regularMarketPrice: 10, previousClose: 8 }, indicators: { quote: [{ close: [9] }] } }] } }` (no `longName`, no `shortName`). | `res.status === 200`; `Object.prototype.hasOwnProperty.call(body, 'name') === true`; `body.name === null`; and `body` deep-equals `{ ticker: 'NONAME', price: 10, previousClose: 8, changePercent: 25, historicalPrice: 9, name: null }` (existing keys unchanged). Optional sub-checks in the same row with the same harness: meta `{ shortName: 'Only Short' }` → `name === 'Only Short'`; meta `{ longName: 'Long', shortName: 'Short' }` → `name === 'Long'`; meta `{ longName: '', shortName: 'Short' }` → `name === 'Short'`. |
| **5a** | `request.get(BASE + '/api/stock')` (no retry) | status 400; `typeof body.error === 'string'`; `'name' in body === false`. |
| **5b** | `…/api/stock?ticker=ZZZZZZZZ99` (retry only on 500) | status ∈ {404, 502}; `typeof body.error === 'string'`; no `name` key. |
| **5c** | `…/api/stock?ticker=BRK.B` (retry only on 500) | status ∈ {404, 502} — i.e. still non-200 with no route-level `-` retry (live today: 502 because Yahoo answers 404); `typeof body.error === 'string'`; no `name` key. |

### Static rows — `tests/autofill-static.spec.ts`

| Row | Command / input | Pass criteria |
|---|---|---|
| **6** | `fs.readFileSync('app/api/stock/route.ts')` | does not match `/(from\s+['"](node:)?fs['"]\|require\(\s*['"](node:)?fs['"]\s*\)\|\bfs\.)/` and does not match `/process\.env/` (same regexes as frozen T-A6, which also runs). |
| **23** | `fs.readFileSync('README.md')` | contains the literal `Manage Stocks`; contains the literal `Company name`; matches `/auto-?fills?\|autofill/i`. |

### Add-stock form rows (stubbed `/api/stock`) — `tests/autofill-e2e.spec.ts`

**Stub** installed on the ADMIN context with `ctx.route('**/api/stock*', …)`.
It records every request in arrival order — `log: string[]` of the **raw**
`ticker` query-param value (not upper-cased; row 8 needs the exact bytes)
— and honours a mutable `delays: Record<string, number>` (ms) keyed by the
upper-cased ticker, awaited before fulfilling. Bodies (every 200 body is
`{ ticker, price: 100, previousClose: 100, changePercent: 0, historicalPrice: 100, name }`):

| Ticker (upper-cased) | Response |
|---|---|
| `AAPL` | 200, `name: 'Apple Inc.'` |
| `MSFT` | 200, `name: 'Microsoft Corporation'` |
| `BRK-B` | 200, `name: 'Berkshire Hathaway Inc.'` |
| `BRK.B` | 502, `{ error: 'stubbed upstream 404' }` |
| `NONAME` | 200, `name: null` |
| `FAIL` | 502, `{ error: 'stubbed upstream failure' }` |
| `NETFAIL` | `route.abort('failed')` |
| `ZZZZ` and anything else | 404, `{ error: 'stubbed unknown ticker' }` |

**Fixture and helpers.** `beforeAll`: `testing.reset`, new context
(viewport 1280×720) + stub, `page.goto('/')`, sign in as ADMIN via the form,
`expect(getByTestId('empty-state')).toBeVisible()`. Locators:
`ticker = getByTestId('stock-form-ticker')`, `nameField = getByTestId('stock-form-name')`,
`tags = getByTestId('stock-form-tags')`, `save = getByTestId('stock-form-save')`,
`form = getByTestId('stock-form')`. `openAdd()` = click `add-stock-button`,
expect `form` visible. `closeForm()` = click the `Cancel` button inside
`form`, expect `form` count 0 (unmount resets all form state, so each row
starts fresh). `blur()` = `ticker.blur()` (dispatches focusout; React's
`onBlur` fires) unless the row says otherwise. Request accounting is always a
**delta**: `const mark = log.length` right after `openAdd()`, then
`log.slice(mark)` after a `page.waitForTimeout(750)` settle (the stub
fulfils synchronously, so 750 ms is ample; use 1500 ms for "zero requests"
assertions). Value assertions use `await expect(nameField).toHaveValue(...)`
(retrying, 15 s). Rows run in the order listed; 19 runs before 18 so the Edit
row has a persisted stock.

| Row | Steps | Pass criteria |
|---|---|---|
| **7** | `openAdd()`; `ticker.fill('AAPL')`; `ticker.press('Tab')` (tab-to-name path). | `nameField` value becomes `Apple Inc.`; `log.slice(mark)` equals `['AAPL']` (exactly one request, for `ticker=AAPL`). `closeForm()`. |
| **8** | `openAdd()`; `ticker.fill('aapl ')`; `nameField.click()` (click-to-name path). | `log.slice(mark)` equals `['AAPL']` (trimmed, upper-cased in the request); `ticker` still has value `'aapl '`; `nameField` value `Apple Inc.`. `closeForm()`. |
| **9** | `openAdd()`; (ticker is empty, autofocused) `blur()`; then `ticker.fill('   ')`; `blur()`; wait 1500 ms. | `log.slice(mark)` equals `[]`; `nameField` value `''`. `closeForm()`. |
| **10a** | `openAdd()`; `ticker.fill('BRK.B')`; `blur()`. | `log.slice(mark)` equals `['BRK.B', 'BRK-B']` in that order (first non-200, exactly one retry); `nameField` value `Berkshire Hathaway Inc.` (the second response's name). `closeForm()`. |
| **10b** | `openAdd()`; `ticker.fill('BRK-B')`; `blur()`. | `log.slice(mark)` equals `['BRK-B']` (first request 200 → no second request); `nameField` `Berkshire Hathaway Inc.`. `closeForm()`. |
| **10c** | `openAdd()`; `ticker.fill('ZZZZ')`; `blur()`. | `log.slice(mark)` equals `['ZZZZ']` (non-dot miss → exactly one request); `nameField` `''`. `closeForm()`. |
| **11** | `openAdd()`; for each of `ZZZZ` (404), `FAIL` (502), `NETFAIL` (network failure), `NONAME` (200 + `name: null`): `ticker.fill(t)`; `blur()`; settle; assert `nameField` `''` and `getByTestId('stock-form-error')` count 0 and `save` enabled. Then `nameField.fill('Zed Co')`; `ticker.fill('FAIL')`; `blur()`; settle; assert `nameField` `'Zed Co'` (typed text stays). Then `ticker.fill('ZZZZ')`; `tags.fill('Misc')`; `tags.press('Enter')`; `save.click()`. | After save: `form` count 0; `[data-testid="stock-row"][data-ticker="ZZZZ"]` visible; its `stock-price` text `—` and `stock-change` has `data-direction="unavailable"` (save with a manual name succeeds exactly as today; failed quote renders `—`). |
| **12** | `openAdd()`; `nameField.fill('My Co')`; `ticker.fill('AAPL')`; `blur()`; settle. | `log.slice(mark)` equals `['AAPL']`; `nameField` still `My Co`. `closeForm()`. |
| **13** | `openAdd()`; `ticker.fill('AAPL')`; `blur()`; expect `Apple Inc.`; `ticker.fill('MSFT')`; `blur()`. | `nameField` becomes `Microsoft Corporation` (untouched autofill is replaceable). Do **not** close — continue in 14. |
| **14** | (continuing) `nameField.fill('MSFT Corp')`; `ticker.fill('AAPL')`; `blur()`; settle. | `nameField` still `MSFT Corp`; `log` delta since 13's second blur equals `['AAPL']` (the lookup was issued but did not write). `closeForm()`. |
| **15** | `openAdd()`; `ticker.fill('AAPL')`; `blur()`; expect `Apple Inc.`; `nameField.fill('')` then `nameField.fill('Apple Inc.')` (or `nameField.clear()` + `pressSequentially('Apple Inc.')`); `ticker.fill('MSFT')`; `blur()`; settle. | `nameField` still `Apple Inc.` (human-authored though identical); the MSFT request was made (`log` delta ends with `'MSFT'`). `closeForm()`. |
| **16** | `openAdd()`; `ticker.fill('AAPL')`; `blur()`; expect `Apple Inc.`; `ticker.fill('ZZZZ')`; `blur()`; settle. | `nameField` still `Apple Inc.` (D6: a miss never writes, even over a stale untouched autofill); `log` delta ends with `'ZZZZ'`. `closeForm()`. |
| **17a** | `delays.AAPL = 1500`; `openAdd()`; `ticker.fill('AAPL')`; `blur()`; immediately `ticker.fill('MSFT')`; `blur()`; expect `nameField` `Microsoft Corporation`; then for 2500 ms sample `nameField.inputValue()` every 100 ms into an array; finally `delete delays.AAPL`. | Every sample equals `Microsoft Corporation`; none equals `Apple Inc.`; final value `Microsoft Corporation`; `log.slice(mark)` equals `['AAPL', 'MSFT']`. `closeForm()`. |
| **17b** | `delays.AAPL = 1500`; `openAdd()`; `ticker.fill('AAPL')`; `blur()`; `ticker.fill('MSFT')` (focus stays in the ticker — no blur, no Tab, no click elsewhere); wait 2500 ms; `delete delays.AAPL`. | `nameField` value `''` (stale AAPL response discarded; MSFT never looked up); `log.slice(mark)` equals `['AAPL']`. `closeForm()`. |
| **19** | `openAdd()`; `ticker.fill('AAPL')`; `blur()`; expect `Apple Inc.`; `tags.fill('Tech')`; `tags.press('Enter')`; `save.click()`; expect `form` count 0 and `[data-testid="stock-row"][data-ticker="AAPL"]` visible. Then Node client: `client = await nodeSignIn(ADMIN)`; `rows = await client.query(anyApi.stocks.list, {})`. Then `await expect(client.mutation(anyApi.stocks.add, { ticker: 'GOOG', name: '', tags: ['Tech'] })).rejects.toThrow(/Company name is required\./)`. | `rows.find(r => r.ticker === 'AAPL').name === 'Apple Inc.'` (exact string persisted through the unchanged `stocks.add`); the blank-name mutation rejects with the unchanged message; `stocks.list` afterwards has no `GOOG`. |
| **18** | Open Edit for AAPL: click `manage-stocks-button`, then `[data-testid="manage-stocks-row"][data-ticker="AAPL"]` → `manage-stocks-edit` (or the card's `edit-stock`); expect `form` heading `Edit AAPL` and `nameField` value `Apple Inc.`; `const mark = log.length`; `ticker.focus()`; `blur()`; `ticker.press('Tab')`; wait 1500 ms. | `log.slice(mark)` equals `[]` (zero `/api/stock` requests from the form); `nameField` still `Apple Inc.`; `ticker` still `AAPL`. Close via `Cancel`, then `manage-stocks-close` if the modal is open. |

Row-level notes for the Verification worker: (i) `fill()` focuses the target,
so filling the name or tags field after the ticker *is* a blur of the ticker —
the rows above account for that in their expected `log` deltas; (ii) the
dashboard's own load/refresh fetches also hit the stub (`fetchOne` after each
save, `refreshAll` on reload) — always count from a `mark` taken after
`openAdd()`; (iii) Playwright's `fill('')` on a controlled React input fires
`onChange` with an empty value, which is exactly the human-clear event D2
describes.

### Regression, build and documentation rows

| Row | Command | Pass criteria |
|---|---|---|
| **20** | `env -u NODE_ENV npm test` on the dev deployment (no `LOOPZAI_CYCLE`). | Exit 0. Every row in `tests/api.spec.ts` (6), `tests/cycle2-api.spec.ts` (1), `tests/cycle2-e2e.spec.ts` (9), `tests/cycle2-functions.spec.ts` (14), `tests/cycle2-static.spec.ts` (3), `tests/cycle3-e2e.spec.ts` (14), `tests/cycle3-static.spec.ts` (1) passes; `tests/cycle3-scoped.spec.ts` V1 and V2 report **skipped**; every new row passes. `git diff --name-only f78266b HEAD -- tests/` lists only the new autofill files (no previous-cycle file modified). |
| **21** | Graded by frozen `tests/cycle2-e2e.spec.ts` T-E5 in the same run. | T-E5 passes: exactly +4 requests on Refresh (one per distinct ticker), zero requests in the 30 s idle window, `FAIL` renders `—` with `data-direction="unavailable"`. |
| **22** | `npx tsc --noEmit`; then `env -u NODE_ENV npm run build`. | Both exit 0; the build's route list still shows `/`, `/_not-found`, `/admin`, `/api/stock`, `/shared/[token]` and nothing new. |
| **23** | See the static row above. | As stated. |

## Verification procedure

Graded end to end on **one tree**: the Execution head (commit C3 below)
plus the Verification freeze commit V0 that adds the new test files. Before
grading, `git status --porcelain -- . ':!.loopzai'` must be empty.

0. **Prerequisites (read back, do not fix here):**
   - `.loopzai/verification-gates.json` has been reconciled by the harness
     owner to this repository's three commands (`npx tsc --noEmit`,
     `npm run build`, `npm test`) — it must no longer name
     `scripts/harness-sanity.mjs`, `scripts/run-src-tests.mjs`,
     `tsconfig.web.json`, an `engine/` cwd, or a vitest minimum of 3105
     tests. Until it is, every gate fails independent of the work (spec,
     Human actions). Verification must not edit that file.
   - `.env.local` points at the **dev** deployment (`CONVEX_DEPLOYMENT=dev:…`,
     not `frugal-anaconda-225`); `npx convex env get E2E_TEST_SECRET` prints
     `loopzai-e2e-dev-secret`; `node_modules` present (else
     `env -u NODE_ENV npm install --include=dev`, and confirm `package.json` /
     `package-lock.json` unchanged); outbound HTTPS to
     `query1.finance.yahoo.com` works (`curl -sI -A Mozilla/5.0 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=1d' | head -1` → `HTTP/2 200`).
   - Nothing stale on :3000: `ss -ltnp | grep ':3000'` is empty, or the
     process there is `next dev` started from the current tree with
     `NEXT_PUBLIC_E2E_TEST_MODE=1`.
1. **Typecheck (criterion 22a):** `npx tsc --noEmit` → exit 0. Includes the
   new test files (tsconfig `include: **/*.ts`), so the row-4 import of the
   route module must type-check.
2. **Build (criterion 22b):** stop any dev server first (`next build` and
   `next dev` share `.next/`), then `env -u NODE_ENV npm run build` → exit
   0, log to `/tmp/cycle1-a<N>-build.log`.
3. **Full suite (criteria 1–21, 23):** `env -u NODE_ENV npm test 2>&1 | tee /tmp/cycle1-a<N>-suite.log`
   — Playwright starts the test-mode dev server itself. Never set
   `LOOPZAI_CYCLE` (re-arming `cycle3-scoped` V1 under `3` would fence this
   cycle's legitimate `components/StockForm.tsx`, `app/api/`, `lib/` edits
   against a stale base). Expected reporter summary: `48 + <new rows> passed`,
   `2 skipped`, `0 failed`, `0 flaky` (`grep -Ec 'failed|flaky' log` = 0
   after excluding the two `skipped` lines). Files run alphabetically:
   `api`, `autofill-api`, `autofill-e2e`, `autofill-static`, `cycle2-*`,
   `cycle3-*`. Budget 20–25 min (T-E5's 30 s idle, live flake waits of up
   to 3 × 30 s on the T-A and autofill-api rows, first-compile latency).
4. **Frozen-file audit:** `git diff --stat V0 HEAD -- tests/` is empty at
   grading time; `git diff --name-only f78266b HEAD -- tests/` contains only
   the new autofill files; `git diff --name-only f78266b HEAD -- convex/ package.json package-lock.json playwright.config.ts` is empty.
5. **Independent spot checks (not machine-scored, cheap):**
   `curl -s 'http://localhost:3000/api/stock?ticker=AAPL'` shows
   `"name":"Apple Inc."` as the last key; `curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3000/api/stock?ticker=BRK.B'` prints `502`
   (or 404) and the body has no `name`.
6. **Verdict:** PASS only when steps 1–4 are all green. A red row is
   classified before any retry: a product defect → rework of the Execution
   files (never a test edit); a defect in a frozen row → the amendment path
   in "Frozen-row repair mechanics" (never a silent edit); a live-Yahoo
   failure that the in-row flake rule already retried 3× → environmental,
   retry the whole attempt. Up to three attempts (`verification.maxAttempts`).
   Playwright `retries` stays 0.

## Git sequencing

Base: `f78266b` (planning dispatch base) on the dispatched branch. Commit
subjects follow the repository's existing pattern
(`loopzai cycle 3 M1: …`, `loopzai cycle 3 verification: …`). Every commit
must typecheck on its own (`npx tsc --noEmit`), touch no previous-cycle test
file, no `convex/**`, no `package*.json`, and no `playwright.config.ts`.

| # | Commit subject | Carries | Milestone |
|---|---|---|---|
| **C1** | `loopzai cycle 1 M1: /api/stock 200 body gains name (longName → shortName → null); error paths unchanged` | `app/api/stock/route.ts`, `.loopzai/execution-log.md` (entry-0001) | M1 |
| **C2** | `loopzai cycle 1 M2+M3: Add-form ticker-blur company-name lookup (normalized ticker, blank guard, dot-class retry, silent miss, Add-only) with autofill-provenance and stale-response write rules` | `lib/quotes.ts`, `components/StockForm.tsx`, `.loopzai/execution-log.md` (entry-0002) | M2, M3 |
| **C3** | `loopzai cycle 1 M4: README autofill sentence; existing Playwright suite green` | `README.md`, `.loopzai/execution-log.md` (entry-0003, recording the local `npm test` result: 48 passed / 2 skipped) | M4 (Execution's part) |
| **V0** | `loopzai cycle 1 verification: freeze test implementation (autofill-api, autofill-e2e, autofill-static)` | the new files under `tests/` only | M4 (frozen rows) |
| **V1…** | `loopzai cycle 1 verification: attempt N — PASS/FAIL (…)` | `.loopzai/verification.md` only | — |

M2 and M3 land in one commit because a form commit that looks up names
without the D2/D7 write rules would be an intermediate state that writes
wrongly; if Execution prefers two commits, C2a may land `fetchCompanyName`
alone (no caller) and C2b the form wiring **including** the write rules —
never a form commit with a weaker rule. Coordinator-owned commits (plan
promotion, milestone status, interventions) interleave and are not
Execution's. No tags, no branches, no force-pushes; Execution and
Verification never commit `.loopzai/state.json`.

## Deploy, restart and rollback

No schema change, migration, environment variable, Convex function change or
production restart is involved. Runtime handoffs, how each is read back, and
how each is reversed:

1. **Gates reconciliation (human, before Execution is dispatched).**
   Read-back: `cat .loopzai/verification-gates.json` names only commands
   that exist here (`npx tsc --noEmit`, `npm run build`, `npm test`), with
   no `engine/` cwd and no vitest minimum. Reverse: `git checkout <sha> -- .loopzai/verification-gates.json`
   to the prior revision (a harness action, never taken by a worker).
2. **Test-mode dev server on :3000 (Verification).** Started by Playwright's
   `webServer` (`npm run dev` with `NEXT_PUBLIC_E2E_TEST_MODE=1`) when
   nothing listens; an existing server is reused, so restart it after any
   `npm run build` (shared `.next/`) and whenever the tree changes between
   attempts: `kill <pid>`; `NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev`.
   Read-back: `curl -s 'http://localhost:3000/api/stock?ticker=AAPL'`
   contains `"name":"Apple Inc."`; `curl -s http://localhost:3000/ | grep -c test-signin` ≥ 1.
   Reverse: stop it; `ss -ltnp | grep ':3000'` empty. (`.next/` is
   gitignored; `rm -rf .next` is a safe reset if the server serves stale
   chunks.)
3. **Convex dev deployment.** Unchanged by this cycle; optional
   `npx convex dev --once` (exit 0, "Convex functions ready") confirms
   reachability and that `E2E_TEST_SECRET` is set. Nothing to reverse.
4. **Production (manual `publishPolicy`, after close-out, when the owner
   chooses).** Frontend: merge/push to `main` → Vercel deploys. Backend:
   **no** `npx convex deploy` is required (nothing under `convex/` changed).
   Read-back: `curl -s 'https://www.sectorwatchlist.com/api/stock?ticker=AAPL'`
   shows `"name":"Apple Inc."`; on the live site, open **Add stock**, type
   `AAPL`, press Tab → Company name reads `Apple Inc.`; open Edit on a stock,
   Tab out of the ticker → no change. Ordering is safe in either direction:
   a client built before the route change treats a missing `name` as a miss
   and writes nothing; a client built after ignores nothing it needs.
   Rollback: `git revert <C3> <C2> <C1>` (reverse order, or one
   `git revert --no-commit C1^..C3` + commit) and push → Vercel redeploys;
   the `name` key disappears, existing consumers (`fetchQuote`, both frozen
   stubs, the shared page) never read it, and no data written by the feature
   differs in shape from a manually typed name, so nothing needs cleaning up.

## Frozen-row repair mechanics

- **Licensed amendments: none.** The specification's Feasibility census
  states `preApprovalFrozenTestAuthorities: []` and "This cycle reddens no
  frozen test row, so no `AUTHORIZE_TEST_AMENDMENT` is needed". This plan
  therefore names no repair, **never creates or amends a frozen-test
  authority**, and neither Execution nor Verification may edit any file
  under `tests/` from a previous cycle, nor the new files once V0 freezes
  them.
- **If a frozen row nonetheless reddens**, the only path is the harness's
  own: Verification reports the red row with evidence in
  `.loopzai/verification.md`; a human decides `AUTHORIZE_TEST_AMENDMENT`
  through the coordinator; the coordinator records it in
  `.loopzai/test-amendments.jsonl` and projects it into
  `.loopzai/spec-amendments.md` as an
  `## Amendment — frozen test <file>: <row> … (cycle 1, <timestamp>)` block
  carrying `<!-- loopzai-amendment kind="test" cycle="1" target-test="…" target-cycle="<origin cycle>" -->`,
  **Target test**, **Target cycle**, **Discovered in cycle**, **Evidence**
  and **Reason (human)**; a repair worker then edits only the named lines of
  the named row (the cycle-3 precedent: `5fc93b1`, `5ab1cc4`), commits as
  `loopzai: cycle 1 — <row> test-harness repair: <what> (authorized amendment)`,
  and logs an execution-log entry naming the commit. A product-behaviour
  disagreement with a frozen row is never repaired in the test; it is a
  product defect (rework) or, if the row and the specification truly
  conflict, a return to Specification.
- **Rows this cycle could plausibly disturb, and the product-side answer
  the plan prefers over any amendment** (Execution should verify each
  before C3):
  - `cycle2-e2e` T-E5 request counting (criterion 21): `fillForm` fills the
    name right after the ticker, so each Add now issues one extra
    `/api/stock` request — all of them land **before** T-E5's baseline
    (`waitForTimeout(2000)` then `mark`), and the frozen stub returns no
    `name`, so nothing is written and the typed name wins. The +4 refresh
    delta and the 30 s idle window are unaffected because no form is open
    then. The `aapl`/`Apple Again` duplicate case: typed name → never
    overwritten.
  - `cycle2-e2e` T-E6 and `cycle3-e2e` T-E4 (Edit): D5 — no request, no
    change; the `initial` early-return must be the first line of the blur
    handler.
  - `cycle3-e2e` T-E9 / `cycle2-e2e` T-E7 (shared page): the shared page
    never mounts `StockForm`; `fetchQuote` is byte-identical.
  - `api.spec.ts` T-A1: an added key cannot fail a `toHaveProperty` list;
    T-A3/T-A4 error bodies are untouched; T-A6 regexes hold because the
    route gains no import.
  - `cycle3-scoped` V1: must stay **skipped** — the run never sets
    `LOOPZAI_CYCLE`.
