/**
 * WC-U: Cycle-3 (CSV) durable codec / planner tests (direct calls, no
 * browser, no server).
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 3 "CSV export /
 * import": D3–D9, D16; Success criteria 2, 3, 4, 5, 6, 15 (planner leg),
 * 16 (parser leg), 21 (validator leg)) and .loopzai/spec-amendments.md
 * (empty), with the test plan in .loopzai/implementation-plan.md as the
 * non-authoritative row source, implemented BEFORE reading
 * execution-log.md or the implementation diff.
 *
 * The lib/ modules must be importable outside React (spec criterion 24,
 * "Architectural constraints") — a plain relative import from lib/ is
 * therefore itself part of the contract: if an import fails, the row fails.
 */
import { test, expect } from '@playwright/test';
import { serializeWatchlist, parseWatchlistCsv } from '../lib/watchlistCsv';
import {
  planImport,
  resolveNames,
  countOutcomes,
  previewSummary,
  reportSummary,
  confirmLabel,
  lookingUpLabel,
  LOOKUP_CONCURRENCY,
} from '../lib/watchlistImport';
import { validateStock } from '../lib/watchlist';

type Triple = { ticker: string; name: string; tags: string[] };

const FILE_A =
  'ticker,name,tags\naapl,Apple Inc.,Tech\nNVDA,,"Chips,Tech"\nGOOG,Alphabet,\nBAD TICKER,Bad,Tech\nNVDA,NVIDIA dup,Chips\nNONAME,,Misc\n';
const FILE_15a = 'ticker,name,tags\nNVDA,NVIDIA,\nNVDA,NVIDIA,Chips\n';
const FILE_15b = 'ticker,name,tags\nNVDA,NVIDIA,Chips\nNVDA,NVIDIA,\n';
const FILE_16 = 'ticker,name\nNVDA,NVIDIA\n';

const FIXTURE_EXISTING = [{ ticker: 'AAPL' }, { ticker: 'MSFT' }];

const MSG_TICKER = 'Ticker is required: 1–10 characters, letters/digits/. ^ - only.';
const MSG_TAGS = 'At least one tag is required.';
const MSG_MISS = 'name = ticker (lookup found nothing)';

/** Spec: rows sorted by upper-cased ticker with the modal's own `<`/`>` comparator. */
function sortByTicker<T extends { ticker: string }>(list: ReadonlyArray<T>): T[] {
  return [...list].sort((a, b) => {
    const x = a.ticker.toUpperCase();
    const y = b.ticker.toUpperCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

test.describe('WC-U (cycle 3): serializeWatchlist / parseWatchlistCsv codec', () => {
  test('WC-U-2 (criterion 2, D3, D4): minimal quoting, doubled quotes, ticker order', () => {
    const out = serializeWatchlist([
      { ticker: 'ZZ', name: 'Foo, Inc.', tags: ['A'] },
      { ticker: 'AB', name: 'Say "hi"', tags: ['X', 'Y Z'] },
    ]);
    expect(out).toBe('ticker,name,tags\nAB,"Say ""hi""","X,Y Z"\nZZ,"Foo, Inc.",A\n');
  });

  test('WC-U-1u (criterion 1 bytes, D3): fixture and empty watchlist; no BOM, no CR', () => {
    const two = serializeWatchlist([
      { ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
      { ticker: 'MSFT', name: 'Microsoft', tags: ['Tech', 'Cloud'] },
    ]);
    const none = serializeWatchlist([]);
    expect(two).toBe('ticker,name,tags\nAAPL,Apple,Tech\nMSFT,Microsoft,"Tech,Cloud"\n');
    expect(none).toBe('ticker,name,tags\n');
    for (const s of [two, none]) {
      expect(s.startsWith('﻿'), 'no BOM').toBe(false);
      expect(s.includes('\r'), 'no CR').toBe(false);
    }
  });

  test('WC-U-3 (criterion 3): BOM, CRLF, case/space-insensitive headers, extra column, blank line, short row', () => {
    const res = parseWatchlistCsv(
      '﻿TICKER, Name ,tags,extra\r\nAAPL,Apple Inc.,"Tech,AI Infra",ignored\r\n\r\nmsft ,,Cloud\r\nX,"Say ""hi"", Inc."\r\n'
    );
    expect(res.error).toBeNull();
    expect(res.rows).toEqual([
      { ticker: 'AAPL', name: 'Apple Inc.', tags: ['Tech', 'AI Infra'] },
      { ticker: 'msft', name: '', tags: ['Cloud'] },
      { ticker: 'X', name: 'Say "hi", Inc.', tags: [] },
    ]);
  });

  test('WC-U-4a (criterion 4): empty string and whitespace-only text → "The file is empty."', () => {
    expect(parseWatchlistCsv('')).toEqual({ rows: [], error: 'The file is empty.' });
    expect(parseWatchlistCsv('  \n\t\n')).toEqual({ rows: [], error: 'The file is empty.' });
  });

  test('WC-U-4b (criterion 4): no ticker column → "Missing required column: ticker."', () => {
    expect(parseWatchlistCsv('symbol,name,tags\nAAPL,Apple,Tech\n')).toEqual({
      rows: [],
      error: 'Missing required column: ticker.',
    });
  });

  test('WC-U-4c (criterion 4, D5): unterminated quoted field — an open quote is not closed by a line break', () => {
    const want = { rows: [], error: 'Could not parse the CSV: unterminated quoted field.' };
    expect(parseWatchlistCsv('ticker,name,tags\nX,"open,A\n')).toEqual(want);
    expect(parseWatchlistCsv('ticker,name,tags\nX,"open\nY,Yes,B\n')).toEqual(want);
  });

  test('WC-U-4d (criterion 4): header only → zero rows, no error', () => {
    expect(parseWatchlistCsv('ticker,name,tags\n')).toEqual({ rows: [], error: null });
  });

  test('WC-U-5a (criterion 5, D5): LF inside a quoted name survives both directions', () => {
    const text = serializeWatchlist([{ ticker: 'NL', name: 'Line one\nLine two', tags: ['A'] }]);
    expect(text).toBe('ticker,name,tags\nNL,"Line one\nLine two",A\n');
    const res = parseWatchlistCsv(text);
    expect(res.error).toBeNull();
    expect(res.rows).toEqual([{ ticker: 'NL', name: 'Line one\nLine two', tags: ['A'] }]);
  });

  test('WC-U-5b (criterion 5, D5): CRLF and lone CR inside quotes are data; CRLF row endings are boundaries', () => {
    const res = parseWatchlistCsv(
      'ticker,name,tags\r\nCR,"Alpha\r\nBeta",A\r\nLF,"Gamma\rDelta",B\r\n'
    );
    expect(res.error).toBeNull();
    expect(res.rows).toEqual([
      { ticker: 'CR', name: 'Alpha\r\nBeta', tags: ['A'] },
      { ticker: 'LF', name: 'Gamma\rDelta', tags: ['B'] },
    ]);
  });

  test('WC-U-6 (criterion 6, D3–D5): round trip — fixed list plus 50 seeded random lists', () => {
    const roundTrip = (L: Triple[], label: string) => {
      const text = serializeWatchlist(L);
      const res = parseWatchlistCsv(text);
      expect(res.error, `${label}: parse error`).toBeNull();
      const want = sortByTicker(L).map((s) => ({ ticker: s.ticker, name: s.name, tags: s.tags }));
      const got = res.rows.map((s) => ({ ticker: s.ticker, name: s.name, tags: s.tags }));
      expect(got, `${label}: triples`).toEqual(want);
    };

    roundTrip(
      [
        { ticker: 'ZETA', name: 'Z, Co', tags: ['A'] },
        { ticker: 'ALPHA', name: 'Say "hi"', tags: ['X', 'Y Z'] },
        { ticker: 'NL', name: 'Line one\nLine two', tags: ['T'] },
        { ticker: 'CR', name: 'Alpha\r\nBeta', tags: ['A', 'B', 'C'] },
        { ticker: 'LONE', name: 'Gamma\rDelta', tags: ['Q'] },
        { ticker: 'PLAIN', name: 'Plain', tags: ['One'] },
        { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.', tags: ['Fin'] },
        { ticker: 'Q2', name: '"quoted" start', tags: ['A B'] },
      ],
      'fixed'
    );

    // Seeded LCG (deterministic across runs).
    let seed = 0x2f6e2b1;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const pick = (alphabet: string) => alphabet[rnd(alphabet.length)];
    const TICKER_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.^-';
    const NAME_ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ,"\r\n.&';
    const TAG_ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ;|';

    for (let i = 0; i < 50; i++) {
      const count = rnd(13); // 0–12 stocks
      const used = new Set<string>();
      const L: Triple[] = [];
      while (L.length < count) {
        let t = '';
        const len = 1 + rnd(10);
        for (let k = 0; k < len; k++) t += pick(TICKER_ALPHA);
        if (used.has(t)) continue;
        used.add(t);
        // Names: 0–20 chars; a valid (stored) name carries no leading/trailing
        // whitespace, so trim the generated text (embedded , " CR LF stay).
        let name = '';
        const nlen = rnd(21);
        for (let k = 0; k < nlen; k++) name += pick(NAME_ALPHA);
        name = name.trim();
        // Tags: 1–4, each 1–8 chars, no leading/trailing space, distinct
        // case-insensitively (as the validator stores them), comma-free.
        const tags: string[] = [];
        const seen = new Set<string>();
        const tcount = 1 + rnd(4);
        let guard = 0;
        while (tags.length < tcount && guard++ < 100) {
          let tag = '';
          const tlen = 1 + rnd(8);
          for (let k = 0; k < tlen; k++) tag += pick(TAG_ALPHA);
          tag = tag.trim();
          if (!tag || seen.has(tag.toLowerCase())) continue;
          seen.add(tag.toLowerCase());
          tags.push(tag);
        }
        L.push({ ticker: t, name, tags });
      }
      roundTrip(L, `random #${i} (${count} stocks)`);
    }
  });

  test('WC-U-16u (criterion 16, D6): no tags column at all → tags [] for the row, no error', () => {
    expect(parseWatchlistCsv(FILE_16)).toEqual({
      rows: [{ ticker: 'NVDA', name: 'NVIDIA', tags: [] }],
      error: null,
    });
  });
});

test.describe('WC-U (cycle 3): planImport / resolveNames planner', () => {
  test('WC-U-15u (criterion 15, D7, D8): first eligible occurrence wins; a rejected row reserves nothing; lookup never invoked', async () => {
    const rowsA = parseWatchlistCsv(FILE_15a).rows;
    const plan = planImport(rowsA, FIXTURE_EXISTING);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ row: 1, ticker: 'NVDA', outcome: 'rejected', reason: MSG_TAGS });
    expect(plan[1]).toMatchObject({
      row: 2,
      ticker: 'NVDA',
      outcome: 'added',
      name: 'NVIDIA',
      tags: ['Chips'],
      lookupPending: false,
    });

    let calls = 0;
    const lookup = async (_t: string) => {
      calls++;
      return 'X';
    };
    const resolved = await resolveNames(plan, lookup);
    expect(calls, 'lookup must never be invoked when every added name is non-blank').toBe(0);
    expect(resolved).toEqual(plan);
    expect(countOutcomes(plan)).toEqual({ added: 1, skipped: 0, rejected: 1, failed: 0 });
    expect(previewSummary(countOutcomes(plan))).toBe('Add 1 · Skip 0 · Reject 1');

    // Contrast (D8): a duplicate of an eligible row is skipped even though its own tags are bad.
    const planB = planImport(parseWatchlistCsv(FILE_15b).rows, FIXTURE_EXISTING);
    expect(planB).toHaveLength(2);
    expect(planB[0]).toMatchObject({ row: 1, ticker: 'NVDA', outcome: 'added', name: 'NVIDIA' });
    expect(planB[1]).toMatchObject({ row: 2, ticker: 'NVDA', outcome: 'skipped', reason: 'duplicate of row 1' });
    expect(previewSummary(countOutcomes(planB))).toBe('Add 1 · Skip 1 · Reject 0');
  });

  test('WC-U-7u (criteria 7, 8, D7–D9): File A through the planner — outcomes, reasons, lookups, immutability', async () => {
    const plan = planImport(parseWatchlistCsv(FILE_A).rows, FIXTURE_EXISTING);
    expect(plan).toHaveLength(6);
    expect(plan.map((r) => r.outcome)).toEqual(['skipped', 'added', 'rejected', 'rejected', 'skipped', 'added']);
    expect(plan.map((r) => r.reason)).toEqual([
      'already in the watchlist',
      null,
      MSG_TAGS,
      MSG_TICKER,
      'duplicate of row 2',
      null,
    ]);
    expect(plan.map((r) => r.row)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plan[0].ticker).toBe('AAPL');
    expect(plan[1].ticker).toBe('NVDA');
    expect(plan[3].ticker).toBe('BAD TICKER');
    expect(plan[5].ticker).toBe('NONAME');
    expect(plan[1].lookupPending).toBe(true);
    expect(plan[5].lookupPending).toBe(true);
    expect(plan[1].tags).toEqual(['Chips', 'Tech']);
    expect(plan[5].tags).toEqual(['Misc']);

    const called: string[] = [];
    const lookup = async (t: string) => {
      called.push(t);
      if (t === 'NVDA') return 'NVIDIA Corporation';
      return null;
    };
    const resolved = await resolveNames(plan, lookup);
    expect([...called].sort()).toEqual(['NONAME', 'NVDA']);
    expect(resolved[1]).toMatchObject({ name: 'NVIDIA Corporation', note: null, lookupPending: false });
    expect(resolved[5]).toMatchObject({ name: 'NONAME', note: MSG_MISS, lookupPending: false });
    expect(resolved.map((r) => r.outcome)).toEqual(plan.map((r) => r.outcome));
    // resolveNames returns a new array; the input plan is unchanged.
    expect(plan[1].lookupPending).toBe(true);
    expect(plan[5].lookupPending).toBe(true);
    expect(previewSummary(countOutcomes(resolved))).toBe('Add 2 · Skip 2 · Reject 2');
  });

  test('WC-U-9u (D9): at most four lookups in flight, once per ticker; a throwing lookup is a miss', async () => {
    expect(LOOKUP_CONCURRENCY).toBe(4);
    const rows: Triple[] = [];
    for (let i = 1; i <= 10; i++) rows.push({ ticker: `T${String(i).padStart(2, '0')}`, name: '', tags: ['A'] });
    const plan = planImport(rows, []);
    expect(plan.every((r) => r.outcome === 'added' && r.lookupPending)).toBe(true);

    let inFlight = 0;
    let maxInFlight = 0;
    const called: string[] = [];
    const remainingSeen: number[] = [];
    const lookup = async (t: string) => {
      called.push(t);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return null;
    };
    const resolved = await resolveNames(plan, lookup, (remaining) => remainingSeen.push(remaining));
    expect(maxInFlight).toBeLessThanOrEqual(LOOKUP_CONCURRENCY);
    expect([...called].sort()).toEqual(rows.map((r) => r.ticker).sort());
    expect(remainingSeen).toHaveLength(10);
    expect(remainingSeen[remainingSeen.length - 1]).toBe(0);
    for (const r of resolved) {
      expect(r).toMatchObject({ outcome: 'added', name: r.ticker, note: MSG_MISS, lookupPending: false });
    }

    // A throwing lookup yields name = ticker and the miss note, never a rejected promise.
    const throwing = async (_t: string): Promise<string | null> => {
      throw new Error('boom');
    };
    const resolved2 = await resolveNames(plan, throwing);
    for (const r of resolved2) {
      expect(r).toMatchObject({ outcome: 'added', name: r.ticker, note: MSG_MISS, lookupPending: false });
    }
  });

  test('WC-U-16s (D16): fixed strings', () => {
    expect(confirmLabel(1)).toBe('Import 1 stock');
    expect(confirmLabel(2)).toBe('Import 2 stocks');
    expect(lookingUpLabel(1)).toBe('Looking up 1 name…');
    expect(lookingUpLabel(3)).toBe('Looking up 3 names…');
    expect(reportSummary({ added: 2, skipped: 2, rejected: 2, failed: 0 })).toBe('Added 2 · Skipped 2 · Rejected 2');
    expect(reportSummary({ added: 1, skipped: 0, rejected: 0, failed: 1 })).toBe(
      'Added 1 · Skipped 0 · Rejected 0 · Failed 1'
    );
  });

  test('WC-U-21u (criterion 21, D4): validateStock rejects a comma inside a tag', () => {
    expect(validateStock({ ticker: 'X', name: 'X', tags: ['A,B'] }, [], null)).toEqual({
      ok: false,
      error: 'Tags may not contain commas.',
    });
  });
});
