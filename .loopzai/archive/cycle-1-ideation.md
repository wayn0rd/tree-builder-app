<!-- ideation.md — Ideation phase output; durable input to the Specification phase. -->

# Cycle 1 Ideation — Sector Watchlist: auto-fill Company name from the ticker

_Cycle 1 of the refreshed LoopzAI harness. The product (Sector Watchlist) already
exists and is mature; this cycle adds one small, additive affordance. It does not
redesign or rebuild anything._

## Refined concept

In the **Add stock** form, when the user enters a ticker and then leaves the
ticker field, the app looks the ticker up and automatically fills the **Company
name** field. Manual entry of a name remains fully possible and is never
clobbered by a lookup the user did not trigger.

Why: today a user types e.g. `AAPL`, then has to know/type "Apple Inc."
by hand. The company name is required to save, so every add carries this manual
friction. The data is already available — the app's existing Yahoo quote call
returns it — it is simply not surfaced.

**Working, concretely:** in the Add-stock form, type a valid ticker (e.g.
`AAPL`), then tab or click away from the ticker field → the Company name field
populates with the looked-up name (e.g. "Apple Inc.") within a moment of the
lookup returning. An unknown/invalid ticker, or a failed lookup, simply leaves
the name field as it was (blank, or whatever the user already typed) — this
introduces **no new blocking condition or error**. The existing "Company name
is required" validation on save is completely unchanged: the user can type a
name manually and save exactly as today. Nothing the user typed into the name
field is ever overwritten by an automatic lookup.

## Scope

- **In:** one behaviour on the existing Add-stock form path; additive change to
  the existing quote proxy to also surface the company name.
- **Out:** the app's data model, save/validation rules, auth, sharing, the
  read-only shared page, and any redesign. No new required fields. No new
  external provider or key.

## Constraints surfaced

- **Additive only.** No schema change; no change to the save path; the name
  stays required (`validateStock`: "Company name is required."). This is friction
  reduction, not a validation change.
- **Reuse the existing data source.** The app already calls Yahoo Finance's chart
  endpoint via `/api/stock`, whose `meta` includes `longName` / `shortName`.
  Surface the name from that *same* request — no new provider, no API key.
  (Verified live: `AAPL → Apple Inc.`, `^GSPC → S&P 500`, lowercase `aapl` is
  normalized.)
- **Degrade exactly like a failed quote.** A failed quote already renders `—`
  and never throws; an unknown ticker returns Yahoo `Not Found`. The autofill
  must fail the same way: blank field, no thrown error, no blocking dialog.
- **Never clobber human input.** A lookup may only write into a name field that
  is empty, or that still holds exactly the value the previous autofill wrote
  (see “Autofill provenance” below) — any value the user typed or edited is
  never overwritten.
- **Add only.** Do not auto-lookup in Edit mode (the name is already present).
- **Small enough for the first admission-test cycle.** Single surface, deterministically testable.

## Decisions (locked with Wayne, 2026-09-20)

- **D1 — Trigger.** Fire on **leaving the ticker field** (blur) — one unambiguous
  event that covers both tab-to-name and click-to-name. _(Wayne: "I like your idea.")_
- **D2 — Overwrite policy.** Fill **only when the name field is empty, or still
  holds the untouched result of the previous autofill**. A value the user typed
  or edited is never overwritten. See “Autofill provenance” below for the exact
  rule. _(Wayne: "I like your proposed.")_
- **D3 — Dot-class tickers (`BRK.B`).** On a lookup miss, retry **once** with `.`
  replaced by `-` (Yahoo: `BRK.B` → Not Found, `BRK-B` → "Berkshire Hathaway
  Inc."). Option (a). _(Wayne: "Option a.")_
- **D4 — Data source.** **Extend** the existing `/api/stock` response to also
  return the company name (reuses the exact request already made), rather than
  adding a separate lookup route. _(Wayne: "My answer for D4 is to extend.")_
- **D5 — Edit mode.** **No** auto-lookup on edit; Add-stock only.
  _(Wayne: "I agree. Auto lookup only on Add.")_

## Behavioral clarifications (added 2026-09-20, pre-freeze precision pass)

Three edge behaviors that the Decisions above imply but did not spell out.
All three are clarifications of the same feature — none of them widen scope.

1. **Lookup failure introduces no new blocking condition.** An unknown
   ticker, a network failure, or any other lookup miss does exactly one
   thing: it does not populate the Company name field. It never shows an
   error, never blocks the Save button, and never changes the existing
   "Company name is required" validation in any way. The user's ability to
   type a name manually and save is completely unaffected — identical to
   today's behavior before this feature existed.

2. **A stale async response must never populate the wrong ticker's result.**
   The lookup is asynchronous; the user can change the ticker field again
   before a prior lookup's response arrives. Example: the user blurs off
   `AAPL` (a lookup for `AAPL` begins), then changes the ticker to `MSFT`
   before the `AAPL` response returns. When the `AAPL` result arrives, it
   must **not** populate "Apple Inc." (or anything else) into the form —
   the form is now about `MSFT`, not `AAPL`. Only a lookup response that
   still matches the ticker currently in the field may write to Company
   name. (Mechanically: the lookup result must be checked against the
   ticker field's CURRENT value before writing, not the value at the time
   the lookup was started.)

3. **Autofill provenance, not mere emptiness.** D2's "never clobber human
   input" rule is stronger than checking whether the field is empty. An
   auto-filled Company name may be overwritten by a **later** ticker lookup
   only for as long as it still holds exactly the untouched value THAT
   autofill produced. The instant the user manually edits the Company name
   field — even to a non-empty value, even to a value that happens to match
   what a lookup would have produced — it becomes human-authored, and no
   subsequent ticker lookup may overwrite it again. (Mechanically: the form
   must track whether the current Company name value is "the untouched
   result of the last autofill" as its own fact, not derive that fact from
   whether the field is empty.)

## Directions considered and rejected (stay rejected)

- **Ticker autocomplete / search-as-you-type** (e.g. suggest `AAPL` vs `AAPU`
  while typing): larger UX surface, more failure modes, and it needs a different
  Yahoo endpoint whose multi-result responses are ambiguous. Not this cycle.
- **Validate the ticker exists on save:** scope creep. Save semantics today do
  not require a live ticker; changing that is a product decision, not an autofill
  detail.
- **Hard-coded symbol→name table:** stale and unmaintainable.
- **Any portfolio/ownership/holdings framing:** the app's own schema explicitly
  excludes ownership (`S1`, `N5`); out of scope, not deferred.