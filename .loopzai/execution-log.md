<!-- execution-log.md — checkpointed action entries for the current cycle; entry format per ARCHITECTURE.md §6. -->

### entry-0001
```yaml
timestamp: 2026-09-22T07:43:00Z
phase: execution
cycle: 3
status: in_progress
commitSha: null
filesTouched: []
milestoneIds: ["M1"]
completesMilestoneIds: []
```
Add the pure, import-free CSV codec `lib/watchlistCsv.ts` — `serializeWatchlist` (ticker-sorted, LF, trailing newline, no BOM, minimal RFC-4180 quoting) and `parseWatchlistCsv` (character state machine: BOM, CR/LF/CRLF row endings, `""` escapes, CR/LF/CRLF kept verbatim inside quotes, blank lines dropped, case-insensitive trimmed headers, unknown columns ignored, the three file-level errors) per spec D3–D6 and criteria 2–6, 16 (M1).
