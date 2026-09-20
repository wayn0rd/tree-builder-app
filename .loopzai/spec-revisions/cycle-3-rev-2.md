<!-- spec.md — the frozen specification, once approved at the Specification gate. -->

# Cycle 3 Specification — "Manage Stocks": one obvious surface for editing and deleting watchlist entries

**Status:** revision 2 — awaiting the spec-approval gate (revision 1 was
reviewed and sent back with five requested changes; see §0).
**Cycle:** 3
**Input:** `.loopzai/ideation.md` (frozen, cycle 3; approved 2026-09-20).
**BASE (cycle-scoped evidence only, never a durable test input):**
`3be145036f2c35f644a1fe0b895b39a784cca29c` — the commit this revision was
dispatched from. Between BASE and the start of Execution only `.loopzai/**`
changes (coordinator gate commits), and every cycle-scoped check excludes
`.loopzai/` anyway.
**One-line summary:** Add a header button **"Manage Stocks"** on the owner
dashboard that opens a modal listing every stock (Ticker · Name · Tags ·
Edit · Delete), sorted by ticker; Edit and Delete reuse the existing
`StockForm` modal and the existing delete-confirm dialog verbatim. Nothing
else changes: no data-model, Convex, per-card, shared-page or add-stock
changes.

This document is self-contained. Verification implements the test plan in
§9 from this document alone; it never sees ideation.md, the Cycle-2 spec,
revision 1 of this spec, or Execution's work.

---

## 0. Revision history — what changed from revision 1 and why

Revision 1 was vetoed on one principle, applied five ways:

> **Freeze the promise, not the snapshot.** A frozen test protects a
> behavior or a required capability; it does not pin byte identity, file
> inventories, route inventories, CSS details or a historical commit unless
> those exact details *are* the product contract.

| Request | Revision-1 problem | Revision-2 resolution |
|---|---|---|
| **1 — byte-pin contracts** | D11 / T-S1–T-S3 froze `convex/**`, `StockForm.tsx`, `SectorCard.tsx`, `WatchlistBoard.tsx`, `lib/**`, Cycle-2 test files, etc. byte-identical to a commit, forever. | Replaced by the semantic promises D5, D6, P3 and durable runtime evidence (T-E4/T-E5/T-E9, T-R1). The "this implementation stayed inside the fence" check survives only as **cycle-scoped evidence V1** (§9.5), which is skipped — never failed — in any future run. |
| **2 — closed-world routes** | T-S4 froze the exact set of `app/**/page.tsx`. | D1 is now "opens in-document; `location.pathname` is unchanged" (durable, T-E2) plus "this cycle adds no page" (cycle-scoped, V1). A future unrelated route cannot fail a Cycle-3 test. |
| **3 — Escape too broad** | D10 gave card-opened Edit/Delete and Add Stock new global Escape-to-close behavior. | D10 narrowed: the listener exists **only while Manage Stocks is open**; outside that flow Add/Edit/Delete keep today's behavior (no Escape handling). That "unchanged outside the flow" is checked cycle-scoped (V2), not frozen as a durable rule. Explicit escalation path if the scoping would require touching the reused components. |
| **4 — magic geometry** | D12 froze `p-4`, `max-w-2xl`, 80 % height, `z-30`/`z-40`, and "viewport (4,4) is backdrop". | D12 is now behavioral: overlay, contained in the viewport with a ≥ 8 px gap, long lists scroll inside the panel, child visibly and interactively above (hit-tested), backdrop clicks dismiss only the topmost layer. New explicit hook `manage-stocks-backdrop`; backdrop-click points are computed from bounding boxes, never hard-coded. |
| **5 — over-specified plan** | 19 machine checks + 5 human. | **12 durable machine checks** (T-E1–9, T-S1, T-B1, T-R1) + **2 cycle-scoped checks** (V1, V2) + 5 human. Dropped: static grep for the button (T-E9 proves it at runtime), `page.tsx` inventory, byte-identity checks, `npx convex dev --once` as a test (it is setup), Escape-on-shared-page, duplicated edit/delete×backdrop/Escape permutations. Coverage of the ten promises the reviewer listed is mapped in §9.0. |

### Material product-behavior changes vs. revision 1 (deliverable item 5)

1. **`Escape` no longer closes card-opened Edit / Delete or `+ Add stock`.**
   Revision 1 added that; revision 2 removes it. `Escape` is handled only
   while Manage Stocks is open (D10).
2. **No prescribed modal dimensions or z-index values.** Revision 1 committed
   to `max-w-2xl`, ≤ 80 % viewport height and `z-30`/`z-40`; revision 2
   commits to the observable behavior only (D12). Execution may still use
   those values.
3. **One additional test hook:** `manage-stocks-backdrop` on the overlay
   element (D13). Not user-visible.

Everything else — modal not route, owner-only, columns, ticker sort, no
search/count/CTA, exact empty-state copy, per-card controls retained, reuse
of `StockForm` / delete-confirm, stacking, reactive updates, frontend-only —
is unchanged from revision 1 and from the frozen ideation.

---

## 1. Ground truth about the codebase this cycle starts from

Stated so Verification and Execution share one picture without reading
each other's work. These are facts, not commitments.

- Owner dashboard: `app/page.tsx` (`Dashboard` component). Header buttons,
  in DOM order: `refresh-prices`, `add-stock-button` ("+ Add stock"),
  `share-button` ("Share"), `signout-button` ("Sign out"). The dashboard
  owns three dialog states: `formOpen`/`editing` (renders
  `components/StockForm.tsx`), `pendingDelete` (renders the inline
  delete-confirm dialog whose confirm button is `confirm-delete` and whose
  other button reads `Cancel`), and `shareOpen` (renders
  `components/SharePanel.tsx`).
- `StockForm` and the delete-confirm dialog are each a full-viewport
  `position: fixed` overlay containing a centered panel; a `mousedown`
  whose target is the overlay itself closes the dialog. **Neither handles
  the `Escape` key today, and neither does `+ Add stock`'s form** (it is
  the same `StockForm`). `StockForm`'s heading reads `Edit <TICKER>` when
  editing and `Add stock` when adding; its panel is the element
  `data-testid="stock-form"`; its tag chips carry a remove button with
  `aria-label="Remove tag <tag>"`; its inputs are `stock-form-ticker`,
  `stock-form-name`, `stock-form-tags` (Enter commits a tag), and its
  submit is `stock-form-save`.
- Sector cards (`components/SectorCard.tsx`) render per-row `edit-stock`
  (✎, `aria-label="Edit <TICKER>"`) and `delete-stock` (🗑) buttons only
  when the board is given `onEdit`/`onDelete` handlers; the shared page
  gives none. Board rows are `stock-row` with `data-ticker`; cards are
  `sector-card` with `data-tag`; the owner's empty board shows
  `empty-state`.
- Stocks come from the reactive Convex query `stocks.list` (returns the
  caller's stocks in insertion order — **not** sorted). Tickers are stored
  upper-cased by validation (`lib/watchlist.ts` / `convex/lib/validate.ts`).
- Test harness (Cycle 2, retained): Playwright, `tests/` dir, serial, one
  worker, a global warm-up in `tests/global-setup.ts`, an env-gated test
  sign-in form (`test-signin-email` / `test-signin-secret` /
  `test-signin-submit`) shown when `NEXT_PUBLIC_E2E_TEST_MODE=1`, and a
  `testing.reset` mutation on the dev deployment. Existing Cycle-2 e2e
  tests `T-E6` (edit MSFT and delete NVDA through the card controls,
  persisted across reload) and `T-E7` (shared page has zero mutating
  controls) live in `tests/cycle2-e2e.spec.ts`.

---

## 2. Decisions (commitments — a veto can be aimed at a number)

D1–D9 are the ideation decisions in binding form. D10–D14 are decisions
made by this specification. Where a decision has both a **durable** part
(a promise the product keeps from now on) and a **cycle-scoped** part (a
statement about *this* implementation), the two are labeled.

- **D1 — It is a modal, not a route.** *Durable:* clicking the button opens
  the modal in the same document; `location.pathname` stays exactly what it
  was (`/`), no navigation occurs, and closing it likewise navigates
  nowhere. *Cycle-scoped:* this cycle adds no `page.tsx` under `app/`
  (V1). Nothing here constrains future unrelated routes.
- **D2 — The button is labeled exactly "Manage Stocks"** and renders only
  inside the owner dashboard (the signed-in, whitelisted view of `/`). It
  never renders on the sign-in screen, the not-invited wall, `/admin`, or
  `/shared/<token>`. Shared / non-owner surfaces expose **no** Manage
  Stocks controls of any kind (no `manage-stocks-*` element).
- **D3 — Row columns are Ticker · Name · Tags · Edit · Delete.** No price,
  change, shares, platform, equity or sector columns. The modal contains no
  `stock-price` or `stock-change` elements.
- **D4 — Rows are sorted by ticker, ascending, case-insensitive,** using
  the same comparison as the sector cards: compare `ticker.toUpperCase()`
  by JavaScript `<`/`>` (UTF-16 code-unit order). No sort control, search,
  filter or pagination.
- **D5 — Per-card ✎ / 🗑 are kept and keep working.** *Durable:* the card
  controls still open the same Edit form / delete-confirm and still save /
  delete (proven by the retained Cycle-2 tests, T-R1, and by H5).
  *Cycle-scoped:* Execution does not modify `components/SectorCard.tsx` or
  `components/WatchlistBoard.tsx` (V1).
- **D6 — Reuse over reimplementation; no second mutation path.**
  *Durable:* Edit from Manage Stocks opens the **same** `StockForm` the
  cards open (same `stock-form` element, heading `Edit <TICKER>`,
  pre-filled ticker/name/tag chips); Delete opens the **same** delete-confirm
  (same `confirm-delete` button, naming the ticker); saves and deletes
  persist server-side exactly as the card paths do. Manage Stocks does not
  itself require any new Convex function, mutation, query, or data-model
  change. *Execution contract:* Edit calls the dashboard's existing
  `setEditing(stock); setFormOpen(true)`; Delete calls the existing
  `setPendingDelete(stock)`; save still goes through the existing
  `handleSave` → `stocks.update`; confirm still goes through the existing
  `handleConfirmDelete` → `stocks.remove`. No new validation. *Cycle-scoped:*
  Execution's diff touches nothing under `convex/` and does not modify
  `components/StockForm.tsx` (V1).
- **D7 — No count.** Button text and modal heading are the exact string
  `Manage Stocks` — no "(5)", no badge.
- **D8 — Empty state.** With zero stocks the modal shows an element
  `manage-stocks-empty` whose exact trimmed text is `No stocks yet.`, zero
  rows, and no call-to-action (no add button, no link, no `Add stock`
  text anywhere inside the modal).
- **D9 — Dismissal and stacking.**
  - The modal closes via its ✕ button (`manage-stocks-close`), a click on
    its own backdrop when no child is active, or `Escape` (D10).
  - Opening Edit or Delete from the modal leaves the modal open
    underneath; the child dialog is **visibly and interactively above** it:
    the child's panel is what the user hits at the child's own center, and
    the child's overlay is what the user hits at the Manage Stocks panel's
    center (D12; T-E6 hit-tests exactly this).
  - Closing the child — by its Cancel, by Save/confirm, by clicking the
    child's backdrop, or by `Escape` — returns the user to the still-open
    Manage Stocks modal. A child's backdrop click dismisses **only that
    child**; `Escape` never closes both layers.
- **D10 — `Escape` handling exists only inside the Manage Stocks flow.**
  - *While Manage Stocks is open,* `Escape` closes **exactly the topmost
    layer**, chosen by fixed priority: (1) `StockForm` if open — identical
    effect to its Cancel (nothing saved, `editing` cleared); else (2)
    delete-confirm if open — identical to its Cancel (nothing deleted);
    else (3) Manage Stocks itself. One key press closes one layer.
  - *While Manage Stocks is closed,* this cycle changes nothing: the
    card-opened Edit / Delete dialogs and the `+ Add stock` form keep their
    existing behavior (today: they do not react to `Escape`). No
    dashboard-wide `Escape` semantics are added. `SharePanel` is untouched.
  - *Execution contract:* one `document`-level `keydown` listener,
    registered only while `manageOpen` is true and removed when it becomes
    false (or on unmount); it reads the current `formOpen` /
    `pendingDelete` state to pick the layer. It may live in `app/page.tsx`
    or in the new modal component (receiving the child-open state as
    props) — either is fine; **`StockForm.tsx` and the delete-confirm
    markup are not modified.** If Execution concludes the scoping cannot
    be achieved cleanly without modifying the reused child components or
    adding disproportionate complexity, it **raises a blocking question**
    describing the obstacle instead of modifying those components or
    silently broadening `Escape` behavior.
  - No confirmation on unsaved changes — parity with backdrop-click.
- **D11 — Execution fence (cycle-scoped; verified by V1, never a durable
  test).** Execution's change set is limited to: a new modal component
  under `components/`, edits to `app/page.tsx`, and `README.md`. In
  particular it does **not** modify: anything under `convex/` (generated
  files excluded), `lib/`, `app/shared/`, `app/api/`, `app/admin/`,
  `components/StockForm.tsx`, `components/SectorCard.tsx`,
  `components/WatchlistBoard.tsx`, `components/SharePanel.tsx`, any
  existing file under `tests/`, `playwright.config.ts`, or `package.json`
  (no new dependencies). It adds no `page.tsx`. Anything beyond this
  requires a spec amendment or a blocking question before it is done. This
  fence describes *this cycle's* implementation; it says nothing about
  what later cycles may change.
- **D12 — Modal presentation (behavioral, not geometric).**
  - Manage Stocks renders as a **modal overlay**: a full-viewport backdrop
    (`manage-stocks-backdrop`) visually dimming the dashboard, with a
    centered panel (`manage-stocks-modal`).
  - The panel **stays inside the viewport with reasonable padding**: at the
    frozen 1280×720 test viewport, its bounding box lies entirely inside
    the viewport with **at least 8 px** between each of its edges and the
    corresponding viewport edge — regardless of how many stocks there are.
  - **Long lists scroll inside the panel**, not the page: with 30 stocks
    the panel still satisfies the containment rule, the page itself does
    not scroll (`window.scrollY` stays 0), and the last row can be brought
    into view within the panel and its Edit clicked.
  - The reused child dialogs render **above** the Manage Stocks panel and
    backdrop (D9's hit-test definition). How Execution achieves this
    (z-index, DOM order) is not a commitment.
  - Clicking the Manage Stocks backdrop dismisses it when no child is
    active. Clicking a child's backdrop dismisses only that child.
- **D13 — Hooks and labels.** New `data-testid`s (all additive):
  `manage-stocks-button`, `manage-stocks-backdrop` (the full-viewport
  overlay element), `manage-stocks-modal` (the **panel**, a descendant of
  the backdrop), `manage-stocks-close`, `manage-stocks-empty`,
  `manage-stocks-row` (with `data-ticker="<stored ticker>"`),
  `manage-stocks-tag` (one per tag chip inside a row), `manage-stocks-edit`,
  `manage-stocks-delete`. Button labels: Edit's visible text is `Edit` with
  `aria-label="Edit <TICKER>"`; Delete's visible text is `Delete` with
  `aria-label="Delete <TICKER>"`; the close button's visible text is `✕`
  with `aria-label="Close Manage Stocks"`. No `role="dialog"`, focus trap,
  or focus restoration is required (parity with the existing dialogs).
  Existing hooks (`edit-stock`, `delete-stock`, `confirm-delete`,
  `stock-form`, `stock-form-*`, `empty-state`, `add-stock-button`,
  `share-button`, …) are preserved unchanged.
- **D14 — New tests live in new files; cycle-scoped checks are gated.**
  Verification adds only `tests/cycle3-*.spec.ts` files. Durable checks go
  in `tests/cycle3-e2e.spec.ts` and `tests/cycle3-static.spec.ts`.
  Cycle-scoped checks go in `tests/cycle3-scoped.spec.ts`, where every
  test begins with `test.skip(process.env.LOOPZAI_CYCLE !== '3', 'cycle-3
  scoped evidence')` so that a run without `LOOPZAI_CYCLE=3` reports them
  **skipped**, never failed. The whole suite (`LOOPZAI_CYCLE=3 npm test`)
  must pass together this cycle.

---

## 3. UI commitments (U)

- **U1 — Header button.** In the owner dashboard header's right-hand
  action group, a `<button type="button" data-testid="manage-stocks-button">`
  with exact text `Manage Stocks`, placed in DOM order **after**
  `add-stock-button` and **before** `share-button`. Styled like `Share`
  (secondary: white background, gray border). Clicking it opens the modal
  (U2) without navigating. It is not rendered anywhere outside the
  `Dashboard` component.
- **U2 — Modal.** A new component `components/ManageStocksModal.tsx`
  (name is a recommendation; the hooks are the commitment), rendered by
  `Dashboard` when `manageOpen` is true, receiving the same `stocks` array
  the board receives plus `onEdit`, `onDelete`, `onClose`. Presentation per
  D12. The overlay element carries `manage-stocks-backdrop` and closes the
  modal on a mousedown whose target is the overlay itself (the same
  `e.target === e.currentTarget` guard the existing dialogs use). The panel
  `manage-stocks-modal` contains: a heading (`h1`–`h3`) with exact text
  `Manage Stocks`; the ✕ close button (`manage-stocks-close`); then either
  the empty state (U5) or the row list (U3) in a region that scrolls when
  the list is taller than the panel allows.
- **U3 — Rows.** One `manage-stocks-row` per stock, sorted per D4, each
  with `data-ticker` equal to the stored ticker. Row content, left to
  right: ticker (bold), company name, one `manage-stocks-tag` chip per tag
  **in the stock's stored tag order** (chip text = the tag exactly), then
  an `Edit` button (`manage-stocks-edit`) and a `Delete` button
  (`manage-stocks-delete`) per D13. No price/quote data (D3).
- **U4 — Edit / Delete wiring.** `manage-stocks-edit` → `onEdit(stock)` →
  the dashboard's existing `setEditing(stock); setFormOpen(true)`; the
  `StockForm` opens pre-filled (heading `Edit <TICKER>`, ticker, name,
  chips). `manage-stocks-delete` → `onDelete(stock)` → existing
  `setPendingDelete(stock)`; the existing delete-confirm opens naming the
  ticker. The modal's `manageOpen` state is untouched by either action or
  by the child's close/save/confirm. Because rows derive from the reactive
  `stocks.list` query, a saved edit or a confirmed delete is reflected in
  the still-open modal and in the sector cards behind it with no reload.
- **U5 — Empty state.** Per D8: `manage-stocks-empty` with exact text
  `No stocks yet.`, zero rows, no CTA. Reached both on first open with no
  stocks and reactively when the last stock is deleted from the modal.
- **U6 — Dismissal / stacking / `Escape`.** Per D9, D10, D12.
- **U7 — Absence elsewhere.** `/shared/<token>`, the sign-in screen, the
  not-invited wall and `/admin` contain zero `manage-stocks-*` elements.

## 4. Docs / build commitments (P)

- **P1 — README.** `README.md` gains one sentence in its feature
  description mentioning the **Manage Stocks** button (the literal string
  `Manage Stocks` appears in README.md).
- **P2 — Builds green.** `npm run build` exits 0. No new dependencies.
- **P3 — No backend deploy needed.** Manage Stocks needs no Convex change
  (D6), so publishing is a frontend-only Vercel deploy from `main`; no
  `npx convex deploy` is required this cycle. (Cycle-scoped evidence that
  `convex/` is untouched: V1.)

---

## 5. Scope boundary — this cycle will NOT

- Change the data model, any Convex table or any Convex function.
- Add search, filtering, pagination, column sorting, a stock count, or a
  responsive-table redesign to the modal (A1: a flat ticker-sorted list is
  assumed sufficient).
- Add bulk actions, multi-select, undo, drag reordering, or inline editing
  in rows.
- Add a call-to-action or add-stock path inside the modal (D8); the
  `+ Add stock` flow is untouched.
- Modify `StockForm.tsx`, `SectorCard.tsx`, `WatchlistBoard.tsx`,
  `SharePanel.tsx`, the shared page, the admin page, or `lib/` (D11).
- Add `Escape` handling to the card-opened Edit / Delete dialogs, to
  `+ Add stock`, or to `SharePanel` (D10) — no dashboard-wide `Escape`.
- Add a focus trap, focus restoration, `role="dialog"`, keyboard
  navigation between rows, or any accessibility architecture beyond
  `aria-label`/`title` on the new controls.
- Prompt before discarding unsaved `StockForm` edits on `Escape`/backdrop.
- Change quote fetching, polling, or refresh behavior.
- Touch, re-freeze or weaken any Cycle-2 test.
- Deploy the Convex backend.
- Add the future "Simple Terms" human-summary feature or any other LoopzAI
  process improvement — separate work, not this project.

---

## 6. Risks and rejected alternatives (one line each, veto-targetable)

### Risks

- **R1 — Frozen Cycle-2 tests.** Mitigation: D11 keeps Execution out of the
  Cycle-2 files (V1) and the full suite is re-run (T-R1).
- **R2 — Reactive updates.** The modal renders the same `stocks` array as
  the board, derived from `useQuery(api.stocks.list)`; T-E4/T-E5/T-E7
  prove edits/deletes appear without reload.
- **R3 — Stacking.** T-E6 hit-tests the child above the modal at runtime;
  H3 checks it visually.
- **R4 — `Escape` capture by browser UI.** A Chromium `<datalist>`
  suggestion popup on the tags input can swallow `Escape`. Tests press
  `Escape` before typing in the tags input (focus starts in the ticker
  input, which has no datalist). Residual flake is small and the loop's
  flaky-classification path exists.
- **R5 — Playwright visibility under an overlay.** `toBeVisible()` ignores
  occlusion, so "modal still visible beneath the child" is assertable;
  tests never *click* the underlying modal while a child is open.
- **R6 — Node-client seeding.** T-E3/T-E8 seed through `stocks.add` with
  the Cycle-2 `test-login` Node harness; `convex/` is unchanged this cycle
  (V1), so the harness contract is stable.
- **R7 — `Escape` scoping needs the reused components.** Judged unlikely
  (the dashboard already owns `formOpen`/`pendingDelete`/`manageOpen`, so a
  `manageOpen`-gated listener needs nothing from the children). If wrong,
  D10's escalation clause applies: blocking question, not a silent change.
- **A1 — Assumption:** a flat ticker-sorted, scrollable list suffices.
  Wrong if a user cannot find a ticker by scrolling; T-E8 shows 30 rows
  remain reachable.

### Rejected alternatives

- A `/stocks` route/page instead of a modal — rejected (D1; a second
  navigation surface for three columns).
- `Escape` handlers inside `StockForm.tsx` and the delete dialog — rejected
  (D6/D11: they would modify reused components; one `manageOpen`-gated
  listener gives the required behavior).
- Dashboard-wide `Escape` for all dialogs (revision 1's D10) — rejected by
  review: not required by the frozen ideation; would broaden product
  behavior opportunistically.
- Suspending `Escape` entirely while a child is open — rejected: Wayne's
  acceptance expects `Escape` to close the topmost dialog.
- Closing Manage Stocks when a child opens and reopening it after —
  rejected (D9: the modal must remain open underneath).
- Byte-identical file freezes as durable tests (revision 1's D11/T-S1–3) —
  rejected by review: they would fail on legitimate future changes; kept
  only as cycle-scoped evidence (V1).
- Closed-world `page.tsx` inventory (revision 1's T-S4) — rejected by
  review; replaced by the in-document/no-navigation promise plus V1.
- Prescribed Tailwind geometry / z-index numbers / a fixed "(4,4) is
  backdrop" coordinate (revision 1's D12) — rejected by review; replaced by
  containment, scrolling and hit-test behavior with computed click points.
- Search/filter box in the modal — deferred (A1; add if a real list proves
  too long).
- Stock count in the button/heading — rejected (D7).
- `role="dialog"` + focus trap — deferred (a11y fence; the existing
  dialogs have neither and parity is the cheaper commitment).
- Inline (in-row) editing — rejected (new mutation/validation path).
- Seeding T-E3's stocks through the UI form — rejected for the Node
  client (faster, deterministic; the UI add path is already covered by the
  Cycle-2 suite).

---

## 7. Milestones (2 — well inside one cycle; no split proposed)

1. **M1 — Surface.** `components/ManageStocksModal.tsx` (U2, U3, U5, D12,
   D13), header button (U1), dashboard wiring of `manageOpen` and the
   `onEdit`/`onDelete` pass-through (U4). Local check: open, sort, edit,
   delete, empty state, no navigation.
2. **M2 — Dismissal, docs, green.** `manageOpen`-gated `Escape` listener
   (D10), backdrop/✕ close, stacking (D9/D12), README sentence (P1),
   `npm run build` exit 0 (P2), existing suite green locally (D11, D14),
   and a self-check that Execution's diff satisfies the D11 fence.

---

## 8. Cost/time estimate (vetoable; 1.5× the point estimates is the cycle's breach threshold)

- **Scale of change:** ~180–260 lines added/changed across **3 files**:
  new `components/ManageStocksModal.tsx` (~120–160 lines), `app/page.tsx`
  (+40–70 lines: state, button, gated `Escape` listener, render),
  `README.md` (+1–3 lines). Verification adds 3 new test files (~300–400
  lines total; fewer assertions than revision 1, plus a small scoped
  file). Reference: Cycle 2 landed ~2,000 lines across ~20 files with a
  backend and an auth system and was estimated at 9 agent-hours / $115;
  this cycle is roughly one-tenth of that surface and touches no backend.
- **Execution effort:** one Execution session, **point estimate 1.5
  agent-hours** (range 1–3). Wall clock through both gates: **same day**;
  the two human gates dominate, not compute.
- **Spend:** **point estimate $45** for the remainder of the cycle
  (Execution ≈ $15, Verification ≈ $30 — the Verification share is larger
  because it writes the Playwright tests and must run the *entire* suite,
  including the live-Yahoo T-A tests and the dev-server warm-up, at least
  once). Range $25–75. Unchanged from revision 1: fewer assertions, but
  the fixed cost of a full-suite run dominates.
- **Breach thresholds (1.5×): 2.25 agent-hours / $67.50.**
- **Uncertainty drivers, largest first:** (1) a second Verification
  attempt roughly doubles Verification spend (each attempt re-runs the
  full suite); the likeliest trigger is an `Escape`/stacking timing flake
  (R4), not a feature defect; (2) dev-server first-compile latency and
  harness races seen in Cycle 2 (mitigated by the retained warm-up);
  (3) Execution over-building the modal (a11y, search) beyond the fence —
  V1 bounds the blast radius. The happy path lands near 1 agent-hour /
  $30; the thresholds absorb one of these going wrong, not two.

---

## 9. Test plan — FROZEN with this spec

Rules of engagement: Verification implements these from this document
alone, may **add** checks, may never remove or weaken one. New tests go in
new files `tests/cycle3-*.spec.ts` (D14). All Cycle-2 test files are
retained unmodified and must pass (T-R1). Verification may add
dev-dependencies only if a spec amendment approves it (none are expected).
Pass criteria on element absence mean **zero matching elements in the
DOM** (`toHaveCount(0)`). "Visible" means Playwright `toBeVisible()`.
"Exact text" means the element's trimmed `textContent` equals the string
(`toHaveText`). A step's expectations must hold within Playwright's
default expect timeout (15 s, `playwright.config.ts`).

### 9.0 How this plan obeys "freeze the promise, not the snapshot"

Two tiers, with a bright line between them:

- **Durable tests** (`tests/cycle3-e2e.spec.ts`, `tests/cycle3-static.spec.ts`;
  T-E1–9, T-S1, T-B1, T-R1) assert only what a user or the product
  contract depends on: what the owner sees and in what order; that Edit
  and Delete are the *same* dialogs the cards open (observed through their
  existing hooks, headings and pre-filled values) and persist server-side;
  reactive updates; stacking observed by hit-testing; containment observed
  by bounding boxes; absence on non-owner surfaces; README mentions the
  feature; build and existing suite green. They name **no commit hash, no
  file inventory, no route inventory, no CSS class, no z-index number, no
  hard-coded viewport coordinate.** The one test in `cycle3-static` is a
  README literal — a documentation promise, not a snapshot.
- **Cycle-scoped checks** (`tests/cycle3-scoped.spec.ts`; V1, V2) hold
  the evidence that *this implementation* stayed inside its fence: the
  diff against BASE touches only permitted files, adds no page, adds no
  dependency, and `Escape` outside the flow behaves as it did at BASE.
  They run only with `LOOPZAI_CYCLE=3` and are **skipped** (never failed)
  otherwise, so a future backend evolution, a new unrelated route, a
  restyled dialog, or a later decision to add `Escape` everywhere cannot
  fail a Cycle-3 test.
- **Litmus applied to every check:** if a future, unrelated, legitimate
  change would fail it while Manage Stocks still works as promised, the
  check is either cycle-scoped or absent.

Coverage map for the ten promises the review asked the plan to prove
strongly: owner-only surface → T-E1, T-E9; ticker-sorted list and fields →
T-E3; Edit reuse + reactive → T-E4; Delete reuse + reactive → T-E5; empty
state → T-E2, T-E7; stacked-dialog / topmost dismissal → T-E6; existing
card controls functional → T-R1 (Cycle-2 T-E6), H5; absent on shared /
non-owner surfaces → T-E9; long-list behavior → T-E8; build / regression
green → T-B1, T-R1.

### 9.1 Environment (frozen; identical to Cycle 2's, restated so this document is self-contained)

- **Setup:** `npm install`; `npx convex dev --once` exits 0 (pushes
  functions to the **dev** deployment named in `.env.local`, which also
  holds `NEXT_PUBLIC_CONVEX_URL`); the dev deployment env var
  `E2E_TEST_SECRET` is set to `loopzai-e2e-dev-secret` (README §"One-time
  dev-deployment preparation"). Never the prod deployment. (The Cycle-2
  static test's secret sweep excludes `.loopzai/`, so this literal here is
  not a violation.)
- **Web server:** Playwright's `webServer` (`npm run dev` with
  `NEXT_PUBLIC_E2E_TEST_MODE=1`, port 3000, `reuseExistingServer`), via
  `npm test`. Tests run serially, one worker. Viewport for all cycle-3 e2e
  tests: **1280×720** (set explicitly with `page.setViewportSize`).
- **Reset:** each new test file first calls `testing.reset({ secret:
  "loopzai-e2e-dev-secret" })` through a `ConvexHttpClient` against
  `NEXT_PUBLIC_CONVEX_URL` (read from `.env.local`), exactly as
  `tests/cycle2-e2e.spec.ts` does.
- **Identities** (via the test sign-in form: `test-signin-email`,
  `test-signin-secret` = the secret above, `test-signin-submit`):
  **ADMIN** = `trixiematic415@gmail.com` (implicitly whitelisted; needs no
  whitelist step), **OUTSIDER** = `e2e-outsider@example.com` (never
  whitelisted).
- **Node-client seeding:** a `ConvexHttpClient` signed in via the
  `api.auth.signIn` action with `{ provider: "test-login", params: {
  email, secret } }` and `client.setAuth(result.tokens.token)` (as in
  `tests/cycle2-functions.spec.ts`), then `stocks.add({ ticker, name,
  tags })` per stock, in the order listed. After seeding, the browser
  page is reloaded before assertions.
- **Quote stub:** route interception on `**/api/stock*` for every browser
  context: `AAPL → {price: 200, previousClose: 100, changePercent: 100}`,
  `MSFT → {price: 90, previousClose: 100, changePercent: -10}`,
  `NVDA → {price: 100, previousClose: 100, changePercent: 0}`, any other
  ticker → HTTP 404 JSON. No cycle-3 e2e test may reach the live quote
  API.
- **Locator conventions:**
  `backdrop` = `[data-testid="manage-stocks-backdrop"]`;
  `modal` = `[data-testid="manage-stocks-modal"]` (the panel);
  `mrow(T)` = `[data-testid="manage-stocks-row"][data-ticker="T"]`;
  `brow(T)` = `[data-testid="stock-row"][data-ticker="T"]` (board row);
  `card(tag)` = `[data-testid="sector-card"][data-tag="tag"]`;
  `box(loc)` = `loc.boundingBox()` (`{x, y, width, height}`, must be non-null);
  `overlayOf(el)` = `el`'s nearest ancestor whose computed `position` is
  `fixed`; `panelOf(el)` = the child of `overlayOf(el)` that contains `el`
  (for `stock-form` this is the `stock-form` element itself; for the
  delete-confirm it is the white panel containing `confirm-delete`);
  `hitAt(x, y)` = `document.elementFromPoint(x, y)` evaluated in the page;
  `center(loc)` = `(box.x + box.width/2, box.y + box.height/2)`;
  `insideViewport(loc, gap)` = `box.x ≥ gap && box.y ≥ gap &&
  box.x + box.width ≤ 1280 − gap && box.y + box.height ≤ 720 − gap`.
- **Backdrop click (Manage Stocks)** = `page.mouse.click(x, y)` with
  `x = (box(backdrop).x + box(modal).x) / 2` and
  `y = box(modal).y + box(modal).height / 2` — the midpoint between the
  backdrop's left edge and the panel's left edge, at the panel's vertical
  middle. D12's ≥ 8 px gap guarantees this point is outside the panel.
- **Backdrop click (child X ∈ {`stock-form`, delete-confirm})** =
  `page.mouse.click(x, y)` with `x = box(panelOf(X)).x / 2` and
  `y = box(panelOf(X)).y + box(panelOf(X)).height / 2` — the midpoint
  between the viewport's left edge and the child panel's left edge. The
  child overlay is full-viewport and topmost, so this lands on the child's
  backdrop, not on Manage Stocks.
- **Stacked-above check for child X** (used by T-E6): (i) `hitAt(center(panelOf(X)))`
  is `panelOf(X)` or a descendant of it — the child is interactively on
  top at its own center; (ii) `hitAt(center(modal))` is **not** `modal` and
  not a descendant of `modal` — the child's overlay/panel covers the Manage
  Stocks panel at its center.
- **Seed set A** (used from T-E3 on; inserted in exactly this order, which
  is deliberately not sorted):
  1. `MSFT` · `Microsoft` · `["Tech", "Cloud"]`
  2. `BRK.B` · `Berkshire Hathaway` · `["Finance"]`
  3. `NVDA` · `NVIDIA` · `["Chips", "Tech"]`
  4. `AAPL` · `Apple` · `["Tech"]`
  5. `A` · `Agilent` · `["Health"]`
  Expected sorted order (D4): `A, AAPL, BRK.B, MSFT, NVDA`.

### 9.2 T-E: durable E2E tests (Playwright, quote stub active) — `tests/cycle3-e2e.spec.ts`

Serial; state builds in the order below within one ADMIN browser context
unless a step says otherwise.

- **T-E1 (U1, U7, D2, D7 — owner-only surface)** — Unauthenticated `/`:
  `signin-screen` visible and `manage-stocks-button` count 0. Sign in as
  ADMIN → `empty-state` visible. Pass: `manage-stocks-button` visible with
  exact text `Manage Stocks`; its `tagName` is `BUTTON`; in DOM order it
  comes after `add-stock-button` and before `share-button` (compare with
  `compareDocumentPosition` or by index among the header's buttons);
  `modal` count 0 and `backdrop` count 0 before any click.
- **T-E2 (U2, U5, D1, D8, D12 — opens in-document; empty state; close)**
  — Record `location.pathname` (expected `/`). Click `manage-stocks-button`.
  Pass: `backdrop` visible; `modal` visible; `location.pathname` still
  equals the recorded value (no navigation occurred); `modal` contains a
  heading (`h1`–`h3`) with exact text `Manage Stocks`;
  `insideViewport(modal, 8)` is true; `manage-stocks-empty` visible with
  exact text `No stocks yet.`; `manage-stocks-row` count 0; inside `modal`,
  `add-stock-button` count 0 and the modal's text does not contain the
  substring `Add stock`; `manage-stocks-close` has
  `aria-label="Close Manage Stocks"`. Click `manage-stocks-close` → `modal`
  count 0, `backdrop` count 0, `empty-state` still visible,
  `location.pathname` unchanged.
- **T-E3 (U3, D3, D4, D13 — list contents and order)** — Seed set A via
  the Node client as ADMIN; reload; click `manage-stocks-button`. Pass:
  `manage-stocks-row` count 5; the `data-ticker` attributes in DOM order
  are exactly `["A","AAPL","BRK.B","MSFT","NVDA"]`; `mrow("MSFT")` contains
  text `MSFT` and `Microsoft`; `mrow("MSFT")`'s `manage-stocks-tag` texts
  in DOM order are exactly `["Tech","Cloud"]`; `mrow("NVDA")`'s are exactly
  `["Chips","Tech"]`; each of the 5 rows contains exactly one
  `manage-stocks-edit` (exact text `Edit`) and exactly one
  `manage-stocks-delete` (exact text `Delete`); `mrow("BRK.B")`'s edit
  button has `aria-label="Edit BRK.B"` and its delete button
  `aria-label="Delete BRK.B"`; inside `modal`, `stock-price` count 0 and
  `stock-change` count 0; `manage-stocks-empty` count 0. Close via
  `manage-stocks-close`.
- **T-E4 (U4 edit, D6, D9, R2 — Edit reuses the existing form; reactive)**
  — Open the modal; click `mrow("MSFT")`'s `manage-stocks-edit`. Pass
  (stacked): `stock-form` visible; its heading exact text `Edit MSFT`;
  `stock-form-ticker` value `MSFT`; `stock-form-name` value `Microsoft`;
  buttons with aria-labels `Remove tag Tech` and `Remove tag Cloud` are
  present; `modal` is still attached and visible. Then fill
  `stock-form-name` with `Microsoft Corp`, fill `stock-form-tags` with `AI`
  and press `Enter`, click `stock-form-save`. Pass (after save, **no
  reload**): `stock-form` count 0; `modal` visible; `mrow("MSFT")`'s text
  contains `Microsoft Corp` and its `manage-stocks-tag` texts in DOM order
  are exactly `["Tech","Cloud","AI"]`; on the board behind,
  `brow("MSFT").first()` contains `Microsoft Corp` and `card("AI")` count
  ≥ 1; row order is still `A, AAPL, BRK.B, MSFT, NVDA`. Then reload, open
  the modal: `mrow("MSFT")` still contains `Microsoft Corp` (persisted
  server-side through the existing update path). Close the modal.
- **T-E5 (U4 delete, D6, D9, R2 — Delete reuses the existing confirm;
  reactive)** — Open the modal; click `mrow("NVDA")`'s
  `manage-stocks-delete`. Pass (stacked): `confirm-delete` visible;
  `panelOf(confirm-delete)`'s text contains `NVDA`; `modal` still attached
  and visible. Click `confirm-delete`. Pass (**no reload**):
  `confirm-delete` count 0; `modal` visible; `mrow("NVDA")` count 0;
  `manage-stocks-row` count 4 in order `A, AAPL, BRK.B, MSFT`; on the
  board, `brow("NVDA")` count 0 and `card("Chips")` count 0 (NVDA was the
  only Chips stock) while `card("Tech")` is still present. Reload, open
  the modal: `manage-stocks-row` count 4 (persisted through the existing
  remove path). Close the modal.
- **T-E6 (D9, D10, D12 — stacking and topmost-only dismissal)** — Each
  sub-step starts with the modal closed unless stated. After every
  `Escape` press, assert the counts of all three layers so that "exactly
  one layer closed" is proven, as listed.
  - (a) Open the modal; press `Escape`. Pass: `modal` count 0; `backdrop`
    count 0; `stock-form` count 0; `confirm-delete` count 0.
  - (b) Open the modal; Manage Stocks backdrop click. Pass: `modal` count
    0; `backdrop` count 0.
  - (c) Open the modal; click `mrow("AAPL")`'s `manage-stocks-edit`;
    `stock-form` visible. Pass: the **stacked-above check** for
    `stock-form` holds ((i) and (ii) in §9.1). Press `Escape` (no typing
    first). Pass: `stock-form` count 0; `modal` visible; `backdrop`
    visible; `mrow("AAPL")` contains `Apple` (nothing saved);
    `manage-stocks-row` count 4.
  - (d) With the modal still open, click `mrow("AAPL")`'s
    `manage-stocks-delete`; `confirm-delete` visible. Pass: the
    stacked-above check for the delete-confirm holds. Press `Escape`.
    Pass: `confirm-delete` count 0; `modal` visible; `mrow("AAPL")` count 1
    (nothing deleted).
  - (e) With the modal still open, click `mrow("AAPL")`'s
    `manage-stocks-edit`; `stock-form` visible; child backdrop click on
    `stock-form`. Pass: `stock-form` count 0; `modal` visible.
  - (f) With the modal still open, click `mrow("AAPL")`'s
    `manage-stocks-delete`; `confirm-delete` visible; click the dialog's
    `Cancel` button (`getByRole('button', { name: 'Cancel' })` within
    `overlayOf(confirm-delete)`). Pass: `confirm-delete` count 0; `modal`
    visible; `mrow("AAPL")` count 1. Press `Escape`. Pass: `modal` count 0;
    `backdrop` count 0.
- **T-E7 (U5, R2 — reactive empty state)** — Open the modal. Delete every
  remaining stock through the modal: for each of `A`, `AAPL`, `BRK.B`,
  `MSFT` in turn, click its `manage-stocks-delete` then `confirm-delete`,
  and assert `mrow(T)` count 0 before continuing. Pass after the last:
  `modal` still visible; `manage-stocks-row` count 0; `manage-stocks-empty`
  visible with exact text `No stocks yet.`; on the board, `sector-card`
  count 0 and `empty-state` visible. Close the modal via
  `manage-stocks-close`; `empty-state` still visible.
- **T-E8 (D4, D12, A1 — long list scrolls inside the panel; last row
  reachable)** — Seed 30 stocks via the Node client as ADMIN, inserted in
  **descending** ticker order `T30, T29, …, T01` (name `Test <nn>`, tags
  `["Bulk"]`). Reload; open the modal. Pass: `manage-stocks-row` count 30;
  `data-ticker`s in DOM order are `T01 … T30` ascending;
  `insideViewport(modal, 8)` is true; `window.scrollY` is 0. Call
  `mrow("T30").scrollIntoViewIfNeeded()`. Pass: `window.scrollY` is still
  0; `insideViewport(modal, 8)` is still true; `box(mrow("T30"))` lies
  entirely inside `box(modal)` (the row was brought into view by scrolling
  *inside* the panel); click `mrow("T30")`'s `manage-stocks-edit` →
  `stock-form` visible with heading `Edit T30`; press `Escape` →
  `stock-form` count 0; `modal` visible. Close the modal.
- **T-E9 (U7, D2 — absent on shared and non-owner surfaces)** — As ADMIN
  (stocks from T-E8 present): click `share-button` → `share-panel` →
  `share-create`; capture the URL from `share-created-url` (contains
  `/shared/` + a token matching `/[A-Za-z0-9_-]{32,}/`). In a **fresh
  unauthenticated context** (stub installed), open that URL. Pass:
  `sector-card` count ≥ 1 and `stock-row` count ≥ 1 (the page did load
  data); every element whose `data-testid` starts with `manage-stocks-`
  (`[data-testid^="manage-stocks-"]`) count 0; `edit-stock`,
  `delete-stock`, `add-stock-button` all count 0. In another fresh
  context, sign in as OUTSIDER: `not-invited` visible and
  `[data-testid^="manage-stocks-"]` count 0. Navigate that OUTSIDER
  context to `/admin`: `[data-testid^="manage-stocks-"]` count 0.

### 9.3 T-S: durable static check — `tests/cycle3-static.spec.ts`

- **T-S1 (P1)** — `README.md` (read from the repo root) contains the
  literal `Manage Stocks`.

### 9.4 T-B / T-R: build and regression

- **T-B1 (P2)** — `npm run build` exits 0.
- **T-R1 (D5, D14, R1 — existing suite remains green)** —
  `LOOPZAI_CYCLE=3 npm test` (the whole `tests/` directory: Cycle-2's
  T-F, T-E, T-A, T-S files plus all three cycle-3 files) exits 0 with
  **zero failed tests**. In particular Cycle-2 **T-E6** (edit MSFT via
  `edit-stock`, delete NVDA via `delete-stock` → `confirm-delete`,
  persisted across reload — this is the durable proof that the per-card
  controls still work) and **T-E7** (shared page has zero mutating
  controls) must still pass unchanged.

### 9.5 V: cycle-scoped evidence — `tests/cycle3-scoped.spec.ts` (gated by `LOOPZAI_CYCLE=3`; skipped otherwise)

These prove that **this cycle's implementation** stayed inside its fence.
They are evidence for the Cycle-3 verification gate only; by construction
they cannot fail in a future cycle (D14 gate), and a future spec may delete
the file. `BASE` = `3be145036f2c35f644a1fe0b895b39a784cca29c`.

- **V1 (D1, D5, D6, D11, P2, P3 — execution diff inside the fence)** —
  Compute `CHANGED` = the union of
  `git diff --name-only BASE -- . ':!.loopzai'` (working tree vs. BASE) and
  `git ls-files --others --exclude-standard -- . ':!.loopzai'` (new
  untracked files), run from the repo root, **minus** any path matching
  `^tests/cycle3-` (Verification's own files) and minus any path under
  `convex/_generated/`. Pass criteria — none of the following appears in
  `CHANGED`: any path under `convex/`, `lib/`, `app/shared/`, `app/api/`,
  `app/admin/`; `components/StockForm.tsx`, `components/SectorCard.tsx`,
  `components/WatchlistBoard.tsx`, `components/SharePanel.tsx`; any path
  under `tests/` (other than the excluded `tests/cycle3-*`);
  `playwright.config.ts`; `package.json` (an unchanged `package.json` is
  the "no new dependencies" evidence; `package-lock.json` is deliberately
  **not** checked, because Verification's own `npm install` may rewrite it
  under a different npm version); any path matching `^app/.*page\.tsx$`
  **other than** `app/page.tsx` (no page added). Record the full `CHANGED`
  list in the verification report as evidence. (A `CHANGED` list
  containing only `app/page.tsx`, `README.md` and one new file under
  `components/` is the expected outcome.)
- **V2 (D10 — no `Escape` semantics added outside the Manage Stocks
  flow)** — In its own reset + ADMIN sign-in, seed `AAPL · Apple · ["Tech"]`
  via the Node client and reload. With `modal` count 0: (a) click
  `brow("AAPL").first()`'s `edit-stock` → `stock-form` visible with heading
  `Edit AAPL`; press `Escape`; wait 500 ms; pass: `stock-form` still
  visible (count 1) — behavior unchanged from BASE, where the form does not
  react to `Escape`; click its `Cancel`. (b) click `brow("AAPL").first()`'s
  `delete-stock` → `confirm-delete` visible; press `Escape`; wait 500 ms;
  pass: `confirm-delete` still visible; click its `Cancel`; `brow("AAPL")`
  count ≥ 1. (c) click `add-stock-button` → `stock-form` visible with
  heading `Add stock`; press `Escape`; wait 500 ms; pass: `stock-form`
  still visible; click its `Cancel`. Throughout, `modal` and `backdrop`
  count 0. *Why scoped, not durable:* this encodes BASE's behavior ("no
  Escape handling outside the flow"), which a future cycle may legitimately
  change; Cycle 3 promises only that it did not change it.

### 9.6 Human checks at the verification gate (not machine-scored; on `https://www.sectorwatchlist.com` once published, or on `localhost:3000` against the dev deployment if publishing is deferred)

- **H1 (U1, U2, D4)** — Wayne, signed in with Google, finds **Manage
  Stocks** in the header without hunting, opens it, and sees every stock
  on his real watchlist in alphabetical ticker order with tags; the page
  URL does not change.
- **H2 (U4)** — Wayne edits a real stock's name via the modal → the modal
  row and the sector card both update immediately; he deletes a throwaway
  stock via the modal → it disappears from both.
- **H3 (D9, D12, R3)** — With Edit open from the modal, the form is fully
  drawn above the list (no bleed-through, backdrop visibly darker), and
  Cancel / `Escape` return to the still-open list; `Escape` again closes
  the list. The list fits on screen and scrolls inside the panel if long.
- **H4 (D2)** — A share link opened in an incognito window shows no
  **Manage Stocks** button.
- **H5 (D5)** — The little ✎ / 🗑 on the cards still work as before.

*End of frozen test plan. 12 durable machine-scored checks (T-E1–9, T-S1,
T-B1, T-R1), 2 cycle-scoped checks (V1, V2), 5 human checks.*
