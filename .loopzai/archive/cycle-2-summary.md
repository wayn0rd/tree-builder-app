# Cycle 2 Summary — Sector Watchlist (persistence, accounts & sharing)

**Date:** 2026-08-25
**Result:** ✅ Passed — all 35 machine tests green + all 7 human checks confirmed

---

## What we built

We took the local-only watchlist from Cycle 1 and gave it **persistent storage,
real accounts, controlled access, and shareable read-only views**:

- **Cloud storage:** every watchlist now lives in **Convex** (in the
  `frugal-anaconda-225` deployment) instead of browser localStorage. Adding,
  editing, and deleting stocks all sync across devices.
- **Invite-only access:** sign-in is real **Google OAuth**, and the visible
  admin page lets Wayne whitelist or unwhitelist emails. Your watchlist only
  shows up if the signed-in account is on the list.
- **Share links:** any signed-in user can generate a **tokenized public URL**
  (e.g. `/share/abc123…`) that works with no sign-in at all, has full live
  pricing but *no edit controls*, and can be revoked at any time.
- **Seeded data:** Wayne's Convex watches are pre-populated from the
  existing `watchlist-seed.md` instead of starting blank.
- **Hardening:** dev webhook URLs no longer hardcode the old production
  domain, and public probe routes now properly 404 when hit.

Deployed to your production Vercel deployment as well:
https://www.sectorwatchlist.com

## Why it matters

Cycle 1 proved the mechanics end-to-end on a local prototype. Cycle 2 was
the first one *with real users in mind* — private by default, shareable if
you want it to be, and durable across your machines instead of living and
dying with a browser profile.

## Testing

- **35 automated checks**, all green: persistence flows, whitelist gating,
  share-link creation/revocation, public route behavior, environment
  separation (dev vs. prod), and the UI's parity with Cycle 1's look.
- **7 human checks you confirmed live on the deployed site:** real-Google
  admin sign-in, no-admin silence, whitelist visible in admin UI, share
  link works in an incognito window with live pricing, prod sign-in shows
  the Google button only (no test form), data persists across machines,
  and the UI still behaves like it did in Cycle 1.

## Two spec amendments along the way, and one lesson

1. **Narrowed a self-contradicting security test:** the original spec
   explicitly wrote down the test bypass secret, and one of the tests
   scanned *the whole repo* for it — so it inevitably failed itself. We
   amended that test's scope to only *application code*, and all tests
   passed again.
2. **Stabilized one timing-sensitive browser test:** the same test
   accidentally fired before the dev server finished compiling, flagging a
   false panic under the 3-strike budget. We amended it to warm the server
   once before running the suite, then regraded it clean.

**Standing lesson I logged while it happened:** when an engine-run agent
backgrounds the spec's browser suite, the session crashes and you miss the
verdict. During this cycle I re-dispatched it in the foreground and that
recovered cleanly — that's the kind of edge case we'd like the engine to
handle by design soon.

## What this proved

It held up through **two frozen-spec amendments** (one security-scope fix,
one environment-stability fix) plus a mid-flight console panic, without the
cycle losing its ability to give you a green verdict by the end. This is
the pattern you'd rely on in much messier settings.

## What's next

Cycle 3 is open ideation. Given what happened this cycle, the most natural
targets are a) the console-side integration tests the engine *should* have
caught, and b) whatever higher-level review you want to do next on your
LoopzAI engine.

---

*Full technical detail — line-by-line spec, every commit, raw test output,
both amendments, and the full 7 human-check transcript — lives in
`.loopzai/archive/cycle-2-*.md` in this repo.*
