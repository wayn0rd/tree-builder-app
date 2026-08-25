<!-- ideation.md — Ideation phase output; durable input to the Specification phase. -->

# Tree Builder App (Sector Watchlist) — Cycle 2 Ideation

**Cycle:** 2
**Status:** FROZEN — ready for Specification
**Date frozen:** 2026-08-24

---

## 1. Refined concept

Cycle 2 turns the Cycle-1 **Sector Watchlist** from a single-browser,
localStorage-only toy into a **multi-user, invite-only, cloud-persisted web
app** with per-user watchlists and shareable view-only links.

**What is being built:** the existing single-page Sector Watchlist
(tickers grouped into freeform tag-based sector cards, live prices + 24h %
change from Yahoo via the existing `/api/stock` route) gains three
capabilities:

### A. Cloud persistence (Convex)
- All watchlist data (a user's stocks: ticker, company name, tags) moves
  from browser `localStorage` to a **Convex** backend.
- Data is durable across browsers, machines, and sessions.
- The Cycle-1 visual design, tag-filtering UX, `?tags=` shareable filter
  URLs, and live-quote behavior are **preserved unchanged** — only the
  storage layer and access model change.

### B. Google login + invite-only access control
- **Google OAuth** sign-in (via Convex Auth). No passwords, no magic links.
- **Login is the front door.** There is NO anonymous/local mode anymore —
  an unauthenticated visitor to the app root sees only a sign-in screen.
- **Invite-only whitelist:** a table of allowed email addresses. A user who
  authenticates with Google but is NOT on the whitelist sees a polite
  "you're not on the invite list" wall and cannot use the app.
- **Admin account:** `trixiematic415@gmail.com` is the admin. It is
  auto-promoted to admin on its first login and is implicitly whitelisted
  (no bootstrap chicken-and-egg).
- **Admin UI:** the admin can view the whitelist and add/remove allowed
  emails. Standard whitelisted user to seed: `waynehoy@gmail.com`.
- **Per-user data:** each whitelisted user has their OWN private
  stocks/tags. Users cannot see each other's watchlists.

### C. Shareable view-only links
- Any user can generate a **tokenized share link** for their whole
  watchlist (e.g. `/shared/<random-unguessable-token>`).
- **Whole-watchlist scope** (not per-sector — that is a later cycle).
- Links are **revocable**; a user may have **multiple** active links.
- Opening a share link requires **no account/login**. The viewer sees the
  same visual page as the owner (sector cards, colors, prices, % change,
  last-refreshed timestamp, and a working manual refresh button) but with
  **all edit/add/delete controls removed** — strictly read-only.

**Who it is for:** Wayne (primary, admin) plus a small hand-picked set of
invited individuals he whitelists. It is explicitly NOT a public
sign-up product in this cycle.

**What "working" means (concrete):**
- Wayne can sign in with Google as the admin, rebuild his 5-sector /
  22-stock watchlist (from `.loopzai/watchlist-seed.md`), and have it
  persist across browsers/machines.
- A whitelisted friend can sign in with their own Google account and build
  their own separate watchlist.
- A non-whitelisted Google account gets the polite wall, not data.
- Wayne can create a share link, open it in an incognito window (no login),
  and see his live-priced watchlist read-only; revoking the link makes it
  stop working.
- The app is deployable to / already deployed at
  `https://www.sectorwatchlist.com` (Vercel) with these features live.

---

## 2. Constraints surfaced

- **Stack (fixed):** Next.js 14 App Router + React 18 + TypeScript +
  Tailwind (existing repo). Add **Convex** (prod deployment already
  provisioned: `https://combative-minnow-928.convex.cloud`) and **Convex
  Auth** for Google OAuth. Reuse the existing `/api/stock` Yahoo quote
  route as-is.
- **Deployment (already done, OUTSIDE the loop):** Vercel project
  `tree-builder-app` is connected to the GitHub repo with custom domain
  `www.sectorwatchlist.com`, auto-deploys from `main`, and has
  `NEXT_PUBLIC_CONVEX_URL` set (Production/Preview/Development). The loop
  does NOT do Vercel setup; it builds code that deploys cleanly onto it.
- **Google OAuth client:** must be created in Google Cloud Console during
  Execution (the exact Convex Auth callback URL is only known once the auth
  code exists). Client ID/Secret are stored in the Convex dashboard as env
  vars, NEVER in the repo or Vercel.
- **No ownership/portfolio data:** still no shares/equity/position-size
  fields (so a shared link reveals nothing about position sizes).
- **No auto-refresh:** prices load on page-open + manual refresh button
  only (Cycle-1 decision, unchanged).
- **Data seeding:** Wayne's original watchlist was lost with localStorage;
  there is nothing to migrate. His 22-stock / 5-sector map is preserved in
  `.loopzai/watchlist-seed.md` and will be re-entered manually post-launch
  under the admin account. The spec does NOT need a data-migration path.
- **Privacy boundary:** an invitee's watchlist is private to them; the
  admin manages the whitelist but the spec should be explicit about whether
  the admin can/cannot browse other users' watchlist contents (default:
  admin manages whitelist only, not a super-reader of others' data —
  confirm in spec).
- **Cycle-1 UX parity:** tag entry (Enter-to-commit chips, commas
  rejected), zero-change rendered `0.00%` unsigned, `last-refreshed` with
  24h time + milliseconds, unknown `?tags=` stays in URL but matches no
  cards — all preserved.

## 3. Directions rejected, and why

- **localStorage / keep it client-only** — rejected: data evaporates across
  browsers/machines (this is literally the bug that motivated Cycle 2).
- **Public sign-up (anyone with a Google account can join)** — rejected for
  now: Wayne wants a curated, invite-only group, not an open product.
  (Revisit in a later cycle if sharing grows.)
- **Per-sector share links** — rejected for Cycle 2 (scope control): share
  links are whole-watchlist only. Per-sector sharing is a future cycle.
- **Single global shared watchlist (no per-user data)** — rejected: each
  invitee builds their own watchlist; a shared global list would mix
  everyone's tickers.
- **Magic-link / email-password auth** — rejected: Google OAuth is the
  desired UX (Wayne's friends all have Google accounts; no password
  management).
- **Public "toggle" share (one stable profile URL)** — rejected in favor of
  tokenized, revocable, multi-link sharing (better hygiene: can kill a link
  without changing anything else).
- **Doing Vercel deployment as part of the loop** — rejected: deployment
  infra was set up outside the loop on 2026-08-24 and is treated as a
  fixed given.

---

*Full conversation context lives in the Cycle-2 ideation session; this file
is the frozen hand-off to Specification.*
