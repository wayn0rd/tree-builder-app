// Watchlist CSV codec — Cycle-3 spec .loopzai/spec.md D3 (export bytes),
// D4 (comma-joined tags), D5 (hand-rolled RFC-4180 subset, character state
// machine), D6 (only `ticker` is a required column), criteria 2–6 and 16.
//
// Pure and importable outside React: no imports, no fetch, no process.env
// (criterion 24). The parser is a state machine over characters, never a
// line splitter — a row boundary is CR, LF or CRLF *outside* quotes only;
// inside quotes those bytes are data.

export interface CsvStock {
  ticker: string;
  name: string;
  tags: string[];
}

export interface ParseResult {
  rows: CsvStock[];
  error: string | null;
}

export const CSV_HEADER = 'ticker,name,tags';
export const EXPORT_FILENAME = 'sector-watchlist.csv';
export const CSV_ERROR_EMPTY = 'The file is empty.';
export const CSV_ERROR_NO_TICKER = 'Missing required column: ticker.';
export const CSV_ERROR_UNTERMINATED =
  'Could not parse the CSV: unterminated quoted field.';

/** D3: quote only when the field holds `,`, `"`, CR or LF; `"` doubled;
 *  CR / LF kept verbatim. Everything else is emitted unchanged. */
function csvField(value: string): string {
  if (
    value.indexOf(',') === -1 &&
    value.indexOf('"') === -1 &&
    value.indexOf('\r') === -1 &&
    value.indexOf('\n') === -1
  ) {
    return value;
  }
  return '"' + value.replace(/"/g, '""') + '"';
}

/** D3: header, one row per stock sorted by upper-cased ticker (the same
 *  `<` / `>` comparison the Manage Stocks modal uses), tags comma-joined
 *  inside one field (D4), LF endings, trailing newline, no BOM. Values are
 *  the stored values verbatim — never trimmed or re-cased. */
export function serializeWatchlist(stocks: ReadonlyArray<CsvStock>): string {
  const sorted = stocks.slice().sort((a, b) => {
    const ta = a.ticker.toUpperCase();
    const tb = b.ticker.toUpperCase();
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  let out = CSV_HEADER + '\n';
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    out +=
      csvField(s.ticker) +
      ',' +
      csvField(s.name) +
      ',' +
      csvField(s.tags.join(',')) +
      '\n';
  }
  return out;
}

// Tokeniser states.
const FIELD_START = 0; // nothing read yet in this field
const UNQUOTED = 1; // inside an unquoted field (`"` is a literal here)
const QUOTED = 2; // inside a quoted field (CR / LF / CRLF are data)
const AFTER_QUOTE = 3; // closing quote seen; text up to the delimiter is literal

/** One pass over UTF-16 units into records. Returns null when EOF arrives
 *  while still inside a quoted field (the open quote swallows the rest of
 *  the file, including any line breaks — D5 / criterion 4). */
function tokenize(text: string): string[][] | null {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let state = FIELD_START;
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text.charAt(i);
    if (state === QUOTED) {
      if (c === '"') {
        if (i + 1 < n && text.charAt(i + 1) === '"') {
          field += '"'; // `""` escape
          i += 2;
        } else {
          state = AFTER_QUOTE;
          i += 1;
        }
      } else {
        field += c; // CR, LF and CRLF included, verbatim
        i += 1;
      }
      continue;
    }
    // Outside quotes.
    if (c === ',') {
      record.push(field);
      field = '';
      state = FIELD_START;
      i += 1;
    } else if (c === '\r' || c === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      state = FIELD_START;
      // CRLF consumes both units; a lone CR or LF is a row ending too.
      i += c === '\r' && i + 1 < n && text.charAt(i + 1) === '\n' ? 2 : 1;
    } else if (c === '"' && state === FIELD_START) {
      state = QUOTED;
      i += 1;
    } else {
      field += c;
      if (state === FIELD_START) state = UNQUOTED;
      i += 1;
    }
  }
  if (state === QUOTED) return null;
  // A trailing row ending at EOF produces no extra record; anything else
  // still pending (including a trailing `,` → one extra empty field) is
  // flushed as the last record.
  if (state !== FIELD_START || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function isBlankRecord(fields: string[]): boolean {
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].trim() !== '') return false;
  }
  return true;
}

/** D5 / D6: BOM stripped; CR, LF or CRLF row endings; quoted fields with
 *  `""` escapes and verbatim CR / LF / CRLF inside; blank lines dropped;
 *  header names matched case-insensitively after trimming; unknown columns
 *  ignored; short rows read missing fields as blank; only `ticker` is
 *  required. Tickers are trimmed (case untouched), names are returned
 *  verbatim, tags are split on `,`, trimmed and emptied of blanks. Nothing
 *  is validated here — the import planner does that. */
export function parseWatchlistCsv(text: string): ParseResult {
  const body = text.charAt(0) === '﻿' ? text.slice(1) : text;
  if (body.trim() === '') {
    return { rows: [], error: CSV_ERROR_EMPTY };
  }
  const tokens = tokenize(body);
  if (tokens === null) {
    return { rows: [], error: CSV_ERROR_UNTERMINATED };
  }
  const records: string[][] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!isBlankRecord(tokens[i])) records.push(tokens[i]);
  }
  if (records.length === 0) {
    // Only delimiters and whitespace (e.g. `,,`): no content at all.
    return { rows: [], error: CSV_ERROR_EMPTY };
  }

  const header = records[0];
  let iTicker = -1;
  let iName = -1;
  let iTags = -1;
  for (let i = 0; i < header.length; i++) {
    const key = header[i].trim().toLowerCase();
    // First occurrence of a column name wins.
    if (key === 'ticker' && iTicker === -1) iTicker = i;
    else if (key === 'name' && iName === -1) iName = i;
    else if (key === 'tags' && iTags === -1) iTags = i;
  }
  if (iTicker === -1) {
    return { rows: [], error: CSV_ERROR_NO_TICKER };
  }

  const rows: CsvStock[] = [];
  for (let r = 1; r < records.length; r++) {
    const fields = records[r];
    const ticker = (iTicker < fields.length ? fields[iTicker] : '').trim();
    const name = iName !== -1 && iName < fields.length ? fields[iName] : '';
    const rawTags = iTags !== -1 && iTags < fields.length ? fields[iTags] : '';
    const tags: string[] = [];
    const parts = rawTags.split(',');
    for (let t = 0; t < parts.length; t++) {
      const tag = parts[t].trim();
      if (tag !== '') tags.push(tag);
    }
    rows.push({ ticker, name, tags });
  }
  return { rows, error: null };
}
