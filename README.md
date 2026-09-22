# Sector Watchlist

An invite-only, tag-driven stock watchlist. Tickers are grouped into
freeform "sector" cards (tags you invent, like `Tech` or `AI Infra`),
each showing live prices and daily % change — green up, red down.
Each sector card's header also carries a compact summary — the
equal-weight mean of its rows' daily % change plus ▲ up / ▼ down
counts (flat and n/a counts appear only when non-zero) — computed
from the quotes already on the page, so the shared read-only view
shows the same numbers. Tag
chips filter the visible cards and mirror into the URL
(`/?tags=Tech,Cloud`). Watchlists are private per user; read-only
snapshots can be shared via tokenized links (`/shared/<token>`) that
need no sign-in and can be revoked at any time. A **Manage Stocks**
button in the header opens one ticker-sorted list of every stock
(ticker, name, tags) with Edit and Delete controls, so entries can be
maintained without hunting through the cards. From the same modal,
**Export CSV** downloads the watchlist as a `ticker,name,tags` file and
**Import CSV** previews such a file — skipping tickers already present,
looking up blank company names, rejecting rows without a tag — and adds
the new rows only after you confirm.

**Live at:** https://www.sectorwatchlist.com

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- [Convex](https://convex.dev) — database + backend functions
- [Convex Auth](https://labs.convex.dev/auth) with Google OAuth
  (invite-only: an admin-managed email whitelist gates every function
  server-side)
- Quotes proxied from Yahoo Finance via `/api/stock` (no key, no auth —
  quotes are public data and the anonymous shared page depends on it).
  In the **Add stock** form, leaving the ticker field auto-fills the
  Company name from that same lookup (`AAPL` → Apple Inc.; `BRK.B` is
  retried as `BRK-B`); a name you typed yourself is never overwritten,
  and a lookup that misses changes nothing.

## Getting started (local dev)

```bash
npm install
npx convex dev --once   # first run: links/creates your dev deployment, writes .env.local
npm run dev             # http://localhost:3000
```

`.env.local` (gitignored, created by the Convex CLI) points
`CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL` at your **dev**
deployment — never prod.

## Environment & test setup

### Convex environment variables

All backend env vars live in the **Convex dashboard** (or `npx convex
env set`) — never in this repo and never in Vercel. Vercel holds only
the build-time `NEXT_PUBLIC_CONVEX_URL`.

| Variable | Dev deployment | Production deployment |
|---|---|---|
| `JWT_PRIVATE_KEY` | required (auth keys, see below) | required |
| `JWKS` | required (auth keys, see below) | required |
| `SITE_URL` | `http://localhost:3000` | `https://www.sectorwatchlist.com` |
| `AUTH_GOOGLE_ID` | optional (only for real Google sign-in in dev) | required |
| `AUTH_GOOGLE_SECRET` | optional (only for real Google sign-in in dev) | required |
| `E2E_TEST_SECRET` | required for the E2E test plan | **NEVER SET** (this enables the test-only sign-in path) |

Build-time (Next.js): `NEXT_PUBLIC_CONVEX_URL` (set by the CLI in
`.env.local` for dev; set in Vercel for prod), and
`NEXT_PUBLIC_E2E_TEST_MODE=1` **only** when running the E2E suite
locally — production never sets it.

### Google OAuth client (one-time, Google Cloud Console)

1. Google Cloud Console → APIs & Services → Credentials → Create
   credentials → **OAuth client ID** → type **Web application**.
2. Authorized JavaScript origin: `https://www.sectorwatchlist.com`.
3. Authorized redirect URI:
   `https://<your-prod-deployment>.convex.site/api/auth/callback/google`
   (the deployment's `CONVEX_SITE_URL`, e.g.
   `https://frugal-anaconda-225.convex.site/api/auth/callback/google`).
4. Store the client on the **production Convex deployment**:

   ```bash
   npx convex env set --prod AUTH_GOOGLE_ID <client id>
   npx convex env set --prod AUTH_GOOGLE_SECRET <client secret>
   ```

   (For Google sign-in against a dev deployment, repeat without
   `--prod` and add `http://127.0.0.1:<port>` / the dev
   `.convex.site` callback to the client.)

### One-time dev-deployment preparation (frozen test plan, spec §10)

Run these once from the repo root to make the E2E/function test suites
runnable on this machine:

```bash
npm install
npx convex dev --once                                  # push functions + typecheck
node scripts/generate-auth-keys.mjs                    # sets JWT_PRIVATE_KEY + JWKS on dev
npx convex env set SITE_URL http://localhost:3000
npx convex env set E2E_TEST_SECRET "$(grep '^E2E_TEST_SECRET=' .env.local | cut -d= -f2-)"
```

The last command reads the test secret from `.env.local` (gitignored;
the value is specified by the frozen test plan in
`.loopzai/spec.md` §10 — add the `E2E_TEST_SECRET=...` line there if
your `.env.local` predates it). Secret values never appear in tracked
files.

### Running the tests

```bash
NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev   # test-mode web server on :3000
npm test                                  # Playwright (serial; shared backend state)
```

The Playwright config starts the web server itself (in test mode) if
one isn't already running. Tests reset the dev deployment via
`testing.reset` and sign in through the env-gated `test-login`
provider — no Google account is touched by machine tests.

### Production deployment

- Frontend: pushes to `main` auto-deploy via Vercel to
  `https://www.sectorwatchlist.com`.
- Backend: `npx convex deploy` pushes functions to the production
  Convex deployment.
- One-time prod setup: `node scripts/generate-auth-keys.mjs --prod`,
  `npx convex env set --prod SITE_URL https://www.sectorwatchlist.com`,
  the Google OAuth vars above, and seed the whitelist:

  ```bash
  npx convex run --prod whitelist:seed
  ```

- Production must **never** set `E2E_TEST_SECRET` or
  `NEXT_PUBLIC_E2E_TEST_MODE` — those exist only so headless tests can
  sign in without Google.

## License

MIT
