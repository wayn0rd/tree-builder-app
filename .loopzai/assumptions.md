<!-- assumptions.md — provisional assumption record; never ground truth until reviewed. -->

### assumption-0001
**Undecided:** what `parseWatchlistCsv` returns for text that is non-blank but yields no record after blank-record dropping (e.g. `,,\n` — only delimiters and whitespace, so no header record exists). The spec pins `The file is empty.` only for the empty string and whitespace-only text, and `Missing required column: ticker.` only for a header that lacks `ticker`.
**Chosen:** treat it as `The file is empty.` (no rows, that error) — a file with no content record at all has no header to be missing a column from.
**Wrong if:** a human prefers `Missing required column: ticker.` for a delimiter-only file, or a verification row pins that text; the choice is one branch in `parseWatchlistCsv` and cheap to flip.

<!-- loopzai-reviewed: assumption-0001 accepted 2026-09-23T04:04:21.823Z -->
