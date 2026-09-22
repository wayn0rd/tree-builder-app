/**
 * WC-S: Cycle-3 (CSV) durable static checks.
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 3 "CSV export /
 * import": D5, D11, Architectural constraints "The lib/ modules must be
 * importable outside React", Success criteria 24 (static legs) and 25)
 * and .loopzai/spec-amendments.md (empty), with the test plan in
 * .loopzai/implementation-plan.md as the non-authoritative row source,
 * implemented BEFORE reading execution-log.md or the implementation diff.
 *
 * Only spec-pinned properties are asserted: the codec and planner carry no
 * 'use client' and no React / Next / Convex import and make no network
 * request; import writes only through the pre-existing stocks.add (no new
 * Convex function is referenced from the page, modal or panel); the README
 * sentence exists alongside every literal earlier cycles pinned.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(process.cwd(), rel));
}

/** Every module specifier imported by the file (static `import … from '…'`). */
function importSpecifiers(src: string): string[] {
  const out: string[] = [];
  const re = /^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  const re2 = /^\s*import\s+['"]([^'"]+)['"]/gm;
  while ((m = re2.exec(src))) out.push(m[1]);
  return out;
}

/**
 * Amended per .loopzai/spec-amendments.md (cycle 3, 2026-09-22T08:44Z,
 * rows WC-S-24a / WC-S-24a2 only): the purity checks below inspect the
 * comment-stripped, executable source so that line and block comment
 * text can never create a false positive. String, template and regex
 * literals are preserved verbatim (a 'use client' string literal or a
 * `fetch(` inside executable text still fails). The semantic contract is
 * unchanged: no 'use client' directive, no process.env, no fetch, no
 * React / Next / Convex import.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  // A `/` begins a regex literal (not division) at the start of the file,
  // after one of these punctuators, or after one of these keywords.
  const regexAfterPunct = /[(,=:[!&|?{};+\-*%<>~^]$/;
  const regexAfterWord = /^(return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      // Line comment: drop to (not including) the line break.
      while (i < n && src[i] !== '\n' && src[i] !== '\r') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      // Block comment: drop through the closing `*/`; keep its line breaks so
      // line-anchored patterns elsewhere still behave.
      const close = src.indexOf('*/', i + 2);
      const end = close === -1 ? n : close + 2;
      out += src.slice(i, end).replace(/[^\n]/g, '');
      i = end;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      // String / template literal: copy verbatim through the closing quote.
      const q = c;
      let j = i + 1;
      while (j < n && src[j] !== q) {
        if (src[j] === '\\') j++;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '/') {
      // Regex literal when the preceding executable token allows it.
      const before = out.replace(/\s+$/, '');
      const word = (before.match(/[A-Za-z_$]+$/) || [''])[0];
      if (before === '' || regexAfterPunct.test(before) || (word !== '' && regexAfterWord.test(word))) {
        let j = i + 1;
        let inClass = false;
        while (j < n && src[j] !== '\n') {
          const ch = src[j];
          if (ch === '\\') { j += 2; continue; }
          if (ch === '[') inClass = true;
          else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) break;
          j++;
        }
        out += src.slice(i, j + 1);
        i = j + 1;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/** Self-check: a broken stripper must fail the row, never pass it. */
function assertStripperWorks(): void {
  const fixture = [
    "// 'use client' in a line comment",
    '/* process.env and fetch( in a block',
    '   comment spanning lines */',
    'const a = "// not a comment";',
    "const b = '/* not a comment */';",
    'const c = `x // y`;',
    'const d = v.replace(/"/g, \'""\'); // trailing use client',
    'const e = 1 / 2; // division then fetch(',
    'export function f() {}',
  ].join('\n');
  const stripped = stripComments(fixture);
  expect(stripped).not.toMatch(/use client|process\.env|\bfetch\(/);
  expect(stripped).toContain('const a = "// not a comment";');
  expect(stripped).toContain("const b = '/* not a comment */';");
  expect(stripped).toContain('const c = `x // y`;');
  expect(stripped).toContain('v.replace(/"/g, \'""\');');
  expect(stripped).toContain('const e = 1 / 2;');
  expect(stripped).toContain('export function f() {}');
  expect(stripped.split('\n').length).toBe(fixture.split('\n').length);
  // Executable text is never removed: a literal directive still fails.
  expect(stripComments("'use client';\nexport const x = 1;")).toMatch(/^'use client';/);
  expect(stripComments('const k = process.env.X;')).toMatch(/process\.env/);
}

function assertPureLib(rel: string, raw: string): void {
  assertStripperWorks();
  const src = stripComments(raw);
  // The stripper removed only comments: every export the rows pin below is
  // still present in the executable text.
  expect(src, `${rel}: executable source retained`).toMatch(/export\s+/);
  expect(src, `${rel}: no 'use client' directive`).not.toMatch(/['"]use client['"]/);
  expect(src, `${rel}: no react import`).not.toMatch(/from\s+['"]react/);
  expect(src, `${rel}: no next import`).not.toMatch(/from\s+['"]next/);
  expect(src, `${rel}: no convex import`).not.toMatch(/from\s+['"]convex/);
  expect(src, `${rel}: no ../convex import`).not.toMatch(/from\s+['"]\.\.\/convex/);
  expect(src, `${rel}: no fetch`).not.toMatch(/\bfetch\(/);
  expect(src, `${rel}: no XMLHttpRequest`).not.toMatch(/XMLHttpRequest/);
  expect(src, `${rel}: no process.env`).not.toMatch(/process\.env/);
  expect(src, `${rel}: no Convex hooks`).not.toMatch(/useQuery|useMutation/);
  expect(src, `${rel}: no require()`).not.toMatch(/\brequire\(/);
  // Importable outside React with no new dependency: every import (if any)
  // is a relative sibling module under lib/.
  for (const spec of importSpecifiers(src)) {
    expect(spec, `${rel}: import '${spec}' must be a relative lib/ module`).toMatch(/^\.\//);
  }
}

test.describe('WC-S (cycle 3): static', () => {
  test('WC-S-24a (criterion 24, D5): lib/watchlistCsv.ts is pure and importable outside React', () => {
    const src = read('lib/watchlistCsv.ts');
    assertPureLib('lib/watchlistCsv.ts', src);
    expect(src).toMatch(/export\s+function\s+serializeWatchlist\b/);
    expect(src).toMatch(/export\s+function\s+parseWatchlistCsv\b/);
  });

  test('WC-S-24a2 (criterion 24, D9): lib/watchlistImport.ts is pure and importable outside React', () => {
    const src = read('lib/watchlistImport.ts');
    assertPureLib('lib/watchlistImport.ts', src);
    expect(src).toMatch(/export\s+(async\s+)?function\s+planImport\b/);
    expect(src).toMatch(/export\s+(async\s+)?function\s+resolveNames\b/);
  });

  test('WC-S-24b (criterion 24, D11): import writes only through stocks.add — no new server call from the owner page', () => {
    const files = ['app/page.tsx', 'components/ManageStocksModal.tsx'];
    if (exists('components/ImportCsvPanel.tsx')) files.push('components/ImportCsvPanel.tsx');
    const allowed = new Set(['users.me', 'stocks.list', 'stocks.add', 'stocks.update', 'stocks.remove']);
    const refs = new Set<string>();
    for (const f of files) {
      const src = read(f);
      for (const m of Array.from(src.matchAll(/\bapi\.([A-Za-z_]+\.[A-Za-z_]+)/g))) refs.add(m[1]);
    }
    expect(refs.has('stocks.add'), 'the page still writes through api.stocks.add').toBe(true);
    const extra = Array.from(refs).filter((r) => !allowed.has(r)).sort();
    expect(extra, 'no Convex function beyond the pre-existing set is referenced').toEqual([]);
    // No page/modal/panel calls a Convex HTTP action or a new route directly.
    for (const f of files) {
      const src = read(f);
      expect(src, `${f}: no useAction`).not.toMatch(/\buseAction\b/);
      for (const m of Array.from(src.matchAll(/\bfetch\(\s*[`'"]([^`'"]*)/g))) {
        expect(m[1], `${f}: fetch target must be the existing /api/stock`).toMatch(/^\/api\/stock/);
      }
    }
  });

  test('WC-S-25 (criterion 25): README describes export / import and keeps every earlier literal', () => {
    const readme = read('README.md');
    expect(readme).toContain('Manage Stocks');
    expect(readme).toContain('Company name');
    expect(readme).toMatch(/auto-?fills?|autofill/i);
    expect(readme).toMatch(/summary/i);
    expect(readme).toMatch(/\bmean\b/i);
    expect(readme).toMatch(/export/i);
    expect(readme).toMatch(/import/i);
    expect(readme).toMatch(/\bCSV\b/);
  });
});
