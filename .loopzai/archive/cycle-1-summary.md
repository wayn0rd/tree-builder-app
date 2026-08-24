# Cycle 1 Summary — Sector Watchlist (tree-builder-app pivot)

**Date:** 2026-08-18
**Result:** ✅ Passed — first full LoopzAI loop, start to finish

---

## What we built

We turned the old **Hierarchical Tree Builder** (a draggable node/connector
canvas app) into a **Sector Watchlist** — a single-page dashboard that
groups stock tickers into custom, tag-based cards with live prices and
daily % change.

**Core idea:** instead of fixed categories, *you* tag each stock however
you want ("Tech", "Cloud", "AI Infra", whatever). The page auto-builds one
card per tag, and a stock with multiple tags shows up on multiple cards.
Click tags to filter down to just the cards you want — that filtered view
is also a shareable URL.

## Why the pivot

The tree/canvas UI was being replaced entirely, not extended. You'd shared
an infographic (colored category cards with tickers listed underneath) as
a style reference, and wanted that visual model driving a real watchlist
instead of the drag-and-drop tree.

**Deliberately left out this round**, by design:
- No ownership/portfolio data — no shares, equity, or platform fields, so
  nobody you eventually share this with can infer your position sizes
- No auto-refresh — prices load on page-open + manual refresh button only
- No public deployment yet — local-only for now; sharing is a future step
- No fixed sector list — tags are 100% freeform, no preset taxonomy

## How it works, concretely

- **Prices:** live from Yahoo Finance (reusing the existing `/api/stock`
  route), no API key needed
- **24h % change:** current price vs. previous close — colored green (up),
  red (down)
- **Storage:** browser localStorage — persists across reloads, lives in
  your browser only for now
- **Add/edit stock:** ticker, company name, one or more tags; validation
  catches empty fields, duplicate tickers, and commas in tags
- **Tag filter:** click tags to narrow the view; the URL updates
  (`/?tags=Tech,Cloud`) so a filtered view is linkable/bookmarkable

## Four judgment calls we made (all approved)

Little gaps the spec didn't pin down — here's what we decided and why:

1. **Adding multiple tags:** type a tag, hit Enter to add it as a chip
   (no comma-separated lists — commas are reserved and trigger a
   validation error instead).
2. **Zero % change:** shows as plain `0.00%` (no + or − sign).
3. **"Last refreshed" timestamp:** shows down to the millisecond, so it
   visibly updates even on a fast re-click.
4. **Old/broken filter links:** if a URL references a tag you've since
   deleted, it just shows no matching cards rather than erroring or
   silently rewriting your URL.

## Testing

- **16 automated tests, all passing** — API behavior (correct prices,
  error handling), the add/edit/delete/validate flow, tag filtering and
  URL sync, empty states, and confirming the old tree UI is completely
  gone.
- **3 things only a human eye can judge, and you checked all three:**
  up/down coloring looks right, card headers are visibly colored, and the
  layout collapses cleanly to one column on a phone-width screen.

## What this proved

This was the first time the LoopzAI engine ran an entire project loop
on its own — idea → locked spec → real code commits → automated tests →
your final sign-off — without you having to manage each step by hand.
The mechanics held up end-to-end on a real app.

## What's next

**Cycle 2 is focused on the interface** — refining the Sector Watchlist's
look/feel/UX now that the underlying functionality is solid.

---

*Full technical detail (line-by-line spec, every commit, raw test output)
lives in `.loopzai/archive/cycle-1-*.md` in this repo if you ever want to
dig in.*
