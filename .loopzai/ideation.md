<!-- ideation.md — Ideation phase output; durable input to the Specification phase. -->

# Tree Builder App — Cycle 1 Ideation

## Refined concept

Pivot tree-builder-app away from its original draggable-canvas
node-and-connector tree UI, toward a **live-priced stock watchlist grouped
into freeform sector cards**, inspired by an AI-infrastructure infographic
Wayne shared (colored header bar per category, tickers + company names
listed underneath).

**What is being built:** a single-page dashboard that shows a grid of
sector cards. Each card has a colored header (the sector name) and lists
the tickers Wayne has assigned to that sector, each showing:
- Ticker + company name
- Current live price
- 24-hour percentage change, colored green (positive) or red (negative)

Sectors are **not fixed categories** — they are freeform/custom, driven
entirely by tags Wayne assigns to the stocks he enters. There is no
preset list of sectors like the infographic's AI-infra categories; that
infographic was a *visual* reference only, not a category reference.

**For whom:** Wayne, primarily to view himself, and eventually to **share
with other people** via a public URL once deployed to Vercel. The shared
view must not expose ownership/portfolio data (see constraints) — it's a
market-data watchlist, not a holdings tracker.

**What "working" means, concretely, for this cycle:**
1. Wayne can add/edit/remove stock entries: ticker, company name, and one
   or more freeform tags (no shares, no equity, no platform — see
   constraints).
2. Wayne can select a set of tags and generate a "custom chart page" /
   report showing only the cards whose stocks carry those tags.
3. Each ticker on a card shows live current price and 24h % change,
   colored red/green, sourced from Yahoo Finance (already integrated in
   this repo's `/api/stock` route).
4. The grid-of-sector-cards visual layout is the primary (only) view for
   this cycle — no draggable canvas, no node connectors, no tree
   hierarchy. That entire interaction model from the original app is
   being replaced, not extended.
5. Public shareability is a stated end-goal for this concept but **out of
   scope to build this cycle** — see constraints/rejected directions.

## Constraints surfaced

- **No ownership/portfolio data of any kind.** No shares, no equity, no
  platform (Schwab/Robinhood/E*Trade) fields. This is explicit and
  deliberate: Wayne does not want people he shares this with to be able
  to infer how much of anything he owns. This also means there is no
  portfolio-totals-style aggregation (no "By Platform"/"By Sector value"
  panels) — sector cards are a *display* grouping of watched tickers,
  not a value rollup.
- **Freeform sectors and tags**, not a fixed enum. Wayne defines his own
  tags per stock; the sector-card grouping in the UI is driven by
  whichever tag set the user filters to when building a custom chart page
  (see "custom chart page" below) — there isn't necessarily one single
  canonical "sector" field distinct from tags; tags **are** the grouping
  mechanism.
- **Custom chart page via tag selection:** Wayne wants to click on/select
  specific tag names and generate a filtered view containing only stocks
  carrying those tags, grouped into cards by tag. This is a named
  feature for this cycle, not a "maybe later."
- **Data source: Yahoo Finance**, reusing the existing unauthenticated
  `/api/stock` route in this repo (no API key required). Finnhub (which
  Mission Control already has a key for) is explicitly **deferred** —
  Wayne wants it added later purely as a **fallback** if/when Yahoo
  Finance breaks or rate-limits, not as a primary or parallel source this
  cycle.
- **24h % change** is a new computed field the current `/api/stock` route
  does not yet return in that exact shape — it currently returns
  `price` (current) and `historicalPrice` (start-of-selected-range close,
  for the day/week/month/YTD/year interval selector built in the prior,
  uncommitted WIP). Specification needs to define exactly how 24h %
  change is computed/sourced from Yahoo's chart API (e.g. previous close
  vs. current, or day-range historicalPrice vs. current) — this is a
  concrete open question to hand to Specification, not resolved here.
- **Eventual public deployment (Vercel)** is a real, stated goal but
  explicitly **not this cycle's scope** (see rejected directions below).
  Any decisions made this cycle should not preclude it (e.g. don't bake
  in anything that only works with local file storage in a way that
  can't survive a Vercel deploy), but auth-less public sharing,
  read-only public routes, etc. are future-cycle work.
- **Reuse over rebuild:** the existing `/api/stock` Yahoo Finance route,
  and the interval-selector groundwork from the prior uncommitted WIP,
  should be reused/adapted rather than rewritten from scratch where they
  fit. The Mission Control "My Stocks" page (`src/app/stocks/my-stocks/`)
  is a useful reference for the add/edit stock modal UX (ticker lookup,
  tags input with autocomplete, sortable list) but its portfolio-specific
  fields (shares, platform, equity) are explicitly **not** being ported.

## Directions rejected, and why

- **Fixed/preset sector categories** (e.g. hardcoding the infographic's
  exact AI-infra categories: Foundry, Servers & Thermal, Battery &
  Storage, etc.) — rejected. Wayne wants this driven entirely by his own
  tags on whatever stocks he adds, not a curated preset taxonomy. The
  infographic was a layout/style reference only.
- **Portfolio/ownership tracking** (shares, equity, platform breakdown,
  "By Platform"/"By Sector value" totals — i.e. porting My Stocks
  wholesale) — rejected. Directly conflicts with the sharing goal: Wayne
  does not want viewers to infer his holdings or position sizes.
- **Keeping the draggable canvas / node-connector tree UI** — rejected.
  The original tree-builder interaction model (freeform node placement,
  manual connections, sector nodes as one node type among several) is
  being fully replaced by the fixed grid-of-cards layout. This is a
  clean pivot, not an additive feature.
- **Finnhub as primary or parallel data source this cycle** — rejected
  for now. Only Yahoo Finance this cycle; Finnhub is noted as a future
  fallback-source enhancement, not built yet.
- **Building public/shareable deployment this cycle** — rejected for
  this cycle. Deployment, auth-less public routes, and any
  privacy/exposure hardening for a public audience are future-cycle
  scope once the local dashboard itself is working and Wayne has used it.
- **Auto-refresh/live-polling prices** — not explicitly requested;
  earlier open question about refresh cadence (auto-poll vs. manual
  button vs. load-only) was never answered by Wayne in this round of
  ideation. Leaving this as an open question for Specification to make a
  concrete, falsifiable call on (with a sensible default, per the
  execution phase's assumption-break posture) rather than re-asking here
  — it's a derivable implementation detail, not a rejected direction.
