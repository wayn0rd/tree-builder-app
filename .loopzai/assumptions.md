<!-- assumptions.md — provisional assumption record; never ground truth until reviewed. -->

### assumption-0001
**Undecided:** the concrete input mechanism for U1's "freeform multi-tag entry" — the spec commits to `stock-form-tags` but not to how multiple tags are entered or separated.
**Chosen:** a single text input where Enter commits the current text as a tag chip (removable), with a datalist of existing watchlist tags as suggestions; any pending text still in the input when Save is clicked is also treated as one candidate tag. Commas are never used as a separator — a comma anywhere in a candidate tag is a validation error, not a split.
**Why:** S2 forbids commas in tags and T-U2(d) requires that "a tag containing a comma" produces a visible `stock-form-error`; if the field split on commas, a comma-containing tag could never reach validation and T-U2(d) would be unimplementable. Counting pending text on Save lets a single-tag add (T-U1: fill `Tech`, click save) work without a separate commit keystroke.
**Wrong if:** Verification's tests enter multiple tags as one comma-separated string (e.g. fill `Tech,Cloud` for T-U4) and expect it to succeed — that input will instead surface a validation error by design.
