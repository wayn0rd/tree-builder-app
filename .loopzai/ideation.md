<!-- ideation.md — Ideation phase output; durable input to the Specification phase. -->

# Sector Watchlist — Cycle 3 Ideation

**Cycle:** 3
**Status:** FROZEN — awaiting the `ideation_approval` hard gate
**Date frozen:** 2026-09-20
**Author:** Trixie (conversation with Wayne)
**Input for:** the Cycle-3 Specification

---

## 1. Refined concept

Editing and deleting a stock, and changing its tags, **already work** — each
sector-card row carries a ✎ (edit) and  (delete) control that open the existing
`StockForm` modal and the existing delete-confirm dialog. But those controls are
tiny, unlabeled, low-contrast glyphs at the row's right edge, and in practice the
owner cannot find them.

Cycle 3 adds **one obvious, centralized surface** for managing the watchlist: a
header button **"Manage Stocks"** that opens a **modal listing every stock**
(Ticker · Name · Tags · Edit/Delete), sorted by ticker. Edit and Delete **reuse
the existing `StockForm` modal and the existing delete-confirm path verbatim** —
no new editing logic, no new deletion logic, no new mutation path.

The model is Mission Control's stock editor **pattern** (a list with per-row
edit/delete), not its columns: this app has ticker, name and tags only.

## 2. What is being built

1. A header button labeled **"Manage Stocks"** (`data-testid="manage-stocks-button"`),
   placed with the other owner-dashboard header actions (`+ Add stock`, `Share`,
   `Sign out`).
2. A **modal** (`data-testid="manage-stocks-modal"`), titled **"Manage Stocks"**,
   listing **all** of the signed-in user's stocks as rows, **sorted by ticker
   ascending (case-insensitive)**.
3. Each **row** (`data-testid="manage-stocks-row"`, `data-ticker="<TICKER>"`)
   shows: **TICKER** · Company name · tag chips · **Edit** · **Delete**.
4. **Edit** (`data-testid="manage-stocks-edit"`) opens the existing `StockForm`
   pre-filled (ticker / name / tags); saving goes through the existing
   `stocks.update`.
5. **Delete** (`data-testid="manage-stocks-delete"`) opens the existing
   delete-confirm dialog; confirming goes through the existing `stocks.remove`.
6. The per-card ✎ /  controls **remain unchanged** (retained by decision D5).

## 3. Decisions (commitments — a veto can be aimed at its number)

- **D1 — It is a modal, not a route.** No new page, no `/stocks` URL.
- **D2 — The button is labeled exactly "Manage Stocks"** and appears only on the
  owner dashboard. It must never appear on `/shared/<token>`, which keeps zero
  mutating controls.
- **D3 — Row columns are Ticker · Name · Tags · actions.** No shares, platform,
  equity or sector columns — this app has no such data.
- **D4 — Rows are sorted by ticker, ascending, case-insensitive.** No user-facing
  sort control, no search, no filter, no pagination.
- **D5 — Per-card ✎ / 🗑 are kept.** The modal is purely additive; nothing on the
  sector cards is removed or relocated.
- **D6 — Reuse over reimplementation.** Edit opens the existing `StockForm`;
  Delete opens the existing confirm dialog. No new mutation path, no new
  validation, no new Convex function, no data-model change.
- **D7 — No header count.** The button and modal header read **"Manage Stocks"**
  only; no stock count is shown this cycle.
- **D8 — Empty-state copy is exactly "No stocks yet."** and the list area is
  empty. **No call-to-action** is added from the Manage Stocks empty state;
  existing add-stock behavior stays where it already lives (the `+ Add stock`
  button, and the board's own empty-state card).
- **D9 — Dismissal & stacking.** The modal closes via its ✕ close button
  (`data-testid="manage-stocks-close"`), a backdrop click, or `Escape`. When Edit
  or Delete is opened from Manage Stocks:
  - the Manage Stocks modal **remains open underneath**;
  - the reused child dialog (`StockForm` / delete-confirm) appears **above** it
    (Manage Stocks sits at a lower z-index, e.g. `z-30`, than the reused dialogs
    at `z-40`);
  - closing the child **returns the user to the still-open Manage Stocks modal**;
  - **Escape and backdrop clicks close only the topmost active dialog** —
    opening or closing the child must never close the underlying Manage Stocks
    modal.

## 4. Explicit non-goals (scope fence)

- No change to the data model, Convex tables, or Convex functions.
- No search, pagination, or responsive-table redesign.
- No bulk actions, multi-select, undo, or reordering.
- No new accessibility architecture (the new controls carry `aria-label`/`title`
  consistent with the existing per-card controls; nothing beyond that).
- No editing from the shared page; no collaborative editing.
- No new quote behavior; no polling.
- No touching the per-card icons or the existing add/edit/delete flows.
- No re-freezing or weakening of any Cycle-2 frozen test.

## 5. Test hooks to add (additive only)

`manage-stocks-button`, `manage-stocks-modal`, `manage-stocks-row`
(with `data-ticker`), `manage-stocks-edit`, `manage-stocks-delete`,
`manage-stocks-close`, `manage-stocks-empty`.

Existing hooks (`edit-stock`, `delete-stock`, `confirm-delete`, `stock-form`,
`stock-form-save`, `empty-state`) are **preserved unchanged**.

## 6. Human-verifiable acceptance

- Click **Manage Stocks** → the modal opens listing every stock, ticker-sorted.
- **Edit** a stock's name and tags → Save → both the modal row **and** the sector
  cards reflect the change.
- **Delete** a stock → confirm → it disappears from the modal **and** the board.
- Per-card ✎ / 🗑 still work exactly as before.
- The modal is absent on a `/shared/<token>` page.
- With Edit open over the modal, closing Edit returns to the still-open modal,
  and pressing `Escape` closes only the topmost dialog.

## 7. Risks / assumptions

- **R1 — Frozen-test compatibility.** Cycle 2's plan (T-E6) exercises
  `edit-stock` / `delete-stock` / `confirm-delete`; all are preserved because the
  card icons are kept and the same components are reused. Verification may **add**
  checks for the new surface but must not weaken existing ones.
- **R2 — Reactive updates.** Convex queries are reactive, so edits/deletes made
  through the reused components should reflect in the still-open modal list
  without a manual refresh. To be confirmed at verification.
- **R3 — z-index stacking.** The Manage Stocks modal must sit *below* the reused
  child dialogs so both render correctly; verified visually.
- **A1 — Assumption:** a simple ticker-sorted flat list is sufficient for a
  watchlist of this size (no search/pagination). *Wrong if* a user maintains a
  list large enough that a ticker cannot be found by scrolling.

## 8. Open product decisions

**None.** The four previously-open details (header count, empty-state copy,
empty-state CTA, stacked-dialog behavior) are resolved as D7, D8 and D9 above.
This document is internally consistent and ready to freeze.