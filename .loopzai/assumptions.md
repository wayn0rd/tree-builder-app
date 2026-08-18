<!-- assumptions.md — provisional assumption record; never ground truth until reviewed. -->

### assumption-0001
**Undecided:** the concrete input mechanism for U1's "freeform multi-tag entry" — the spec commits to `stock-form-tags` but not to how multiple tags are entered or separated.
**Chosen:** a single text input where Enter commits the current text as a tag chip (removable), with a datalist of existing watchlist tags as suggestions; any pending text still in the input when Save is clicked is also treated as one candidate tag. Commas are never used as a separator — a comma anywhere in a candidate tag is a validation error, not a split.
**Why:** S2 forbids commas in tags and T-U2(d) requires that "a tag containing a comma" produces a visible `stock-form-error`; if the field split on commas, a comma-containing tag could never reach validation and T-U2(d) would be unimplementable. Counting pending text on Save lets a single-tag add (T-U1: fill `Tech`, click save) work without a separate commit keystroke.
**Wrong if:** Verification's tests enter multiple tags as one comma-separated string (e.g. fill `Tech,Cloud` for T-U4) and expect it to succeed — that input will instead surface a validation error by design.

### assumption-0002
**Undecided:** the rendered text for a zero change — U4 specifies signed formatting with examples only for positive (`+1.23%`) and negative (`-0.45%`) values.
**Chosen:** exactly-zero change renders as `0.00%` (no sign), with `data-direction="flat"` as committed.
**Why:** neither `+0.00%` nor `-0.00%` is meaningful; `data-direction` is the machine-verified criterion per U4, so the flat text is free choice.
**Wrong if:** a test asserts the literal string `+0.00%` (or any signed form) for the flat case.

### assumption-0003
**Undecided:** the display format of `last-refreshed` — U6 only says it "shows the time of the last completed fetch".
**Chosen:** 24-hour local time with milliseconds appended (e.g. `14:03:07.523`).
**Why:** T-U8 requires the `last-refreshed` text to *change* after a refresh click; with second-resolution text, a refresh completing within the same second as the previous one would leave the text identical and fail the test. Millisecond resolution makes the change essentially guaranteed.
**Wrong if:** a test asserts a specific time format that excludes milliseconds, or a human review rejects the precision as visual noise.

### assumption-0004
**Undecided:** behavior when the URL's `?tags=` selection references tags that don't exist in the watchlist (e.g. stale link after deletions).
**Chosen:** unknown tags stay in the selection (and URL) but simply match no cards; only tags actually present in the watchlist render as filter chips or cards. A selection consisting solely of unknown tags shows a grid with no cards (not the empty-state, which is reserved for a zero-stock watchlist per U7).
**Why:** simplest behavior consistent with D4 (URL restores the same filtered view) and U7 (empty-state is about zero stocks, not zero filter matches); silently rewriting the URL would fight direct navigation.
**Wrong if:** review wants stale tags pruned from the URL on load, or a "no matches" placeholder for filtered-to-nothing views.
