/**
 * T-F: Function/ACL tests (Node + ConvexHttpClient against the dev
 * deployment). Cycle 2.
 *
 * FROZEN — derived solely from .loopzai/spec.md (§1 D3–D7/D10, §2 S1–S4,
 * §3 F1–F8, §10 T-F1..T-F12 + T-F7b + T-F10b) and
 * .loopzai/spec-amendments.md, implemented before reading
 * execution-log.md or the implementation diff.
 *
 * Harness per spec §10 Environment:
 * - ConvexHttpClient against NEXT_PUBLIC_CONVEX_URL (dev deployment,
 *   read from .env.local — never prod).
 * - Sign in via the api.auth.signIn action with
 *   { provider: "test-login", params: { email, secret } } and
 *   client.setAuth(result.tokens.token) (F8/D10).
 * - String/anyApi function references so the tests do not depend on the
 *   implementation's source.
 * - "Rejects/throws" = the returned promise rejects.
 * - Each test file first calls testing.reset (secret
 *   "loopzai-e2e-dev-secret") so runs are repeatable; tests run serially
 *   and build state in spec order.
 */
import { test, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import * as fs from 'fs';
import * as path from 'path';

const SECRET = 'loopzai-e2e-dev-secret'; // frozen, spec §10 Environment
const ADMIN = 'trixiematic415@gmail.com';
const INVITED = 'e2e-invited@example.com';
const OTHER = 'e2e-other@example.com';
const OUTSIDER = 'e2e-outsider@example.com';

const TOKEN_RE = /^[A-Za-z0-9_-]{32,}$/; // D7
const HEX64_RE = /[a-f0-9]{64}/; // a SHA-256 hex leaking anywhere

function convexUrl(): string {
  const env = fs.readFileSync(
    path.join(process.cwd(), '.env.local'),
    'utf8'
  );
  const m = env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  if (!m) throw new Error('NEXT_PUBLIC_CONVEX_URL not found in .env.local');
  const url = m[1].trim();
  if (/frugal-anaconda-225/.test(url)) {
    throw new Error('.env.local points at PROD — refusing to run tests');
  }
  return url;
}

const URL_ = convexUrl();

function anonClient(): ConvexHttpClient {
  return new ConvexHttpClient(URL_);
}

async function signIn(email: string): Promise<ConvexHttpClient> {
  const client = anonClient();
  const res: any = await client.action(anyApi.auth.signIn, {
    provider: 'test-login',
    params: { email, secret: SECRET },
  });
  const token = res?.tokens?.token;
  if (!token) {
    throw new Error(
      `test-login sign-in for ${email} returned no tokens.token (D10/F8): ` +
        JSON.stringify(res)
    );
  }
  client.setAuth(token);
  return client;
}

/** whitelist.list rows may be strings or row objects; normalize to emails. */
function emailsOf(list: any[]): string[] {
  return list.map((r) => (typeof r === 'string' ? r : r.email));
}

type Client = ConvexHttpClient;

// Serial state built up across tests, in spec order.
let admin: Client;
let invited: Client;
let other: Client;
let outsider: Client;
let invitedAaplId: any; // INVITED's AAPL _id (T-F5..)
let invitedMsftId: any; // INVITED's MSFT _id (T-F7b)
let token1: string; // share tokens (T-F8..)
let token2: string;
let link1Id: any;
let link2Id: any;

test.describe.configure({ mode: 'serial' });

test.describe('T-F: Function/ACL (ConvexHttpClient, dev deployment)', () => {
  test.beforeAll(async () => {
    // Reset (spec §10 Environment): repeatable runs.
    await anonClient().mutation(anyApi.testing.reset, { secret: SECRET });
  });

  test('T-F1 (F1, D10): OUTSIDER signs in via test-login; users.me shapes', async () => {
    outsider = await signIn(OUTSIDER);
    const me: any = await outsider.query(anyApi.users.me, {});
    expect(me).not.toBeNull();
    expect(me.email).toBe(OUTSIDER);
    expect(me.isAdmin).toBe(false);
    expect(me.isWhitelisted).toBe(false);

    const anonMe = await anonClient().query(anyApi.users.me, {});
    expect(anonMe).toBeNull();
  });

  test('T-F2 (gate rule): OUTSIDER + unauthenticated calls all reject', async () => {
    await expect(outsider.query(anyApi.stocks.list, {})).rejects.toThrow();
    await expect(
      outsider.mutation(anyApi.stocks.add, {
        ticker: 'AAPL',
        name: 'Apple',
        tags: ['Tech'],
      })
    ).rejects.toThrow();
    await expect(outsider.mutation(anyApi.share.create, {})).rejects.toThrow();
    await expect(outsider.query(anyApi.share.list, {})).rejects.toThrow();
    await expect(anonClient().query(anyApi.stocks.list, {})).rejects.toThrow();
  });

  test('T-F3 (D3): ADMIN is admin+whitelisted with an EMPTY whitelist table', async () => {
    // No whitelist.add has happened since reset — the table is empty.
    admin = await signIn(ADMIN);
    const me: any = await admin.query(anyApi.users.me, {});
    expect(me.email.toLowerCase()).toBe(ADMIN);
    expect(me.isAdmin).toBe(true);
    expect(me.isWhitelisted).toBe(true);
  });

  test('T-F4 (F5, D4, S2): add trims+lowercases, idempotent; INVITED gains access', async () => {
    await admin.mutation(anyApi.whitelist.add, {
      email: ' E2E-Invited@Example.COM ',
    });
    // idempotency (S2 amendment): adding again succeeds, still one row
    await admin.mutation(anyApi.whitelist.add, { email: INVITED });
    const list: any[] = await admin.query(anyApi.whitelist.list, {});
    const emails = emailsOf(list).filter((e) => e === INVITED);
    expect(emails).toEqual([INVITED]); // exactly once, trimmed+lowercased

    invited = await signIn(INVITED);
    await invited.mutation(anyApi.stocks.add, {
      ticker: 'AAPL',
      name: 'Apple',
      tags: ['Tech'],
    });
    const stocks: any[] = await invited.query(anyApi.stocks.list, {});
    expect(stocks.map((s) => s.ticker)).toEqual(['AAPL']);
  });

  test('T-F5 (F2, F3, D5): per-user isolation; admin cannot mutate cross-user', async () => {
    await admin.mutation(anyApi.stocks.add, {
      ticker: 'MSFT',
      name: 'Microsoft',
      tags: ['Tech'],
    });

    const invitedStocks: any[] = await invited.query(anyApi.stocks.list, {});
    expect(invitedStocks.map((s) => s.ticker)).toEqual(['AAPL']);
    for (const s of invitedStocks) {
      expect(s).toHaveProperty('_id');
      expect(s).toHaveProperty('ticker');
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('tags');
    }
    invitedAaplId = invitedStocks[0]._id;

    const adminStocks: any[] = await admin.query(anyApi.stocks.list, {});
    expect(adminStocks.map((s) => s.ticker)).toEqual(['MSFT']);

    // Admin is not a super-mutator (F3/D5)
    await expect(
      admin.mutation(anyApi.stocks.remove, { id: invitedAaplId })
    ).rejects.toThrow();
    await expect(
      admin.mutation(anyApi.stocks.update, {
        id: invitedAaplId,
        ticker: 'AAPL',
        name: 'Hacked',
        tags: ['Tech'],
      })
    ).rejects.toThrow();

    const after: any[] = await invited.query(anyApi.stocks.list, {});
    expect(after.length).toBe(1);
    expect(after[0].ticker).toBe('AAPL');
    expect(after[0].name).toBe('Apple');
  });

  test('T-F6 (F5): whitelist functions reject for a non-admin whitelisted user', async () => {
    await expect(invited.query(anyApi.whitelist.list, {})).rejects.toThrow();
    await expect(
      invited.mutation(anyApi.whitelist.add, { email: 'x@example.com' })
    ).rejects.toThrow();
    await expect(
      invited.mutation(anyApi.whitelist.remove, { email: OUTSIDER })
    ).rejects.toThrow();
  });

  test('T-F7 (F4, S4): server-side validation rejects without mutating; per-user uniqueness', async () => {
    const before: any[] = await invited.query(anyApi.stocks.list, {});
    const bad: Array<[string, any]> = [
      ['(a) empty ticker', { ticker: '', name: 'X', tags: ['Tech'] }],
      [
        '(b) ticker >10 chars',
        { ticker: 'TOOLONGTICKER1', name: 'X', tags: ['Tech'] },
      ],
      ['(c) invalid char', { ticker: 'AA$PL', name: 'X', tags: ['Tech'] }],
      ['(d) empty name', { ticker: 'GOOG', name: '', tags: ['Tech'] }],
      ['(e) empty tags', { ticker: 'GOOG', name: 'Alphabet', tags: [] }],
      [
        '(f) comma in tag',
        { ticker: 'GOOG', name: 'Alphabet', tags: ['a,b'] },
      ],
      [
        '(g) case-insensitive dup',
        { ticker: 'aapl', name: 'Apple Again', tags: ['Tech'] },
      ],
    ];
    for (const [label, args] of bad) {
      await expect(
        invited.mutation(anyApi.stocks.add, args),
        `${label} must reject`
      ).rejects.toThrow();
      const now: any[] = await invited.query(anyApi.stocks.list, {});
      expect(now.length, `${label} must not mutate`).toBe(before.length);
    }

    // S4: a DIFFERENT user adding AAPL succeeds (whitelist OTHER first)
    await admin.mutation(anyApi.whitelist.add, { email: OTHER });
    other = await signIn(OTHER);
    await other.mutation(anyApi.stocks.add, {
      ticker: 'AAPL',
      name: 'Apple',
      tags: ['Tech'],
    });
    const otherStocks: any[] = await other.query(anyApi.stocks.list, {});
    expect(otherStocks.map((s) => s.ticker)).toEqual(['AAPL']);
  });

  test('T-F7b (F4, S4): uniqueness on edit — rename onto owned ticker rejects', async () => {
    await invited.mutation(anyApi.stocks.add, {
      ticker: 'MSFT',
      name: 'Microsoft',
      tags: ['Tech'],
    });
    const list: any[] = await invited.query(anyApi.stocks.list, {});
    invitedMsftId = list.find((s) => s.ticker === 'MSFT')._id;

    await expect(
      invited.mutation(anyApi.stocks.update, {
        id: invitedMsftId,
        ticker: 'aapl',
        name: 'Microsoft',
        tags: ['Tech'],
      })
    ).rejects.toThrow();
    const after: any[] = await invited.query(anyApi.stocks.list, {});
    expect(after.find((s) => s._id === invitedMsftId).ticker).toBe('MSFT');

    // a rename that keeps a distinct ticker succeeds (edit excludes itself)
    await invited.mutation(anyApi.stocks.update, {
      id: invitedMsftId,
      ticker: 'MSFT',
      name: 'Microsoft Corp',
      tags: ['Tech'],
    });
    const renamed: any[] = await invited.query(anyApi.stocks.list, {});
    expect(renamed.find((s) => s._id === invitedMsftId).name).toBe(
      'Microsoft Corp'
    );
  });

  test('T-F8 (F6, D7, S3): two distinct hashed tokens; list exposes only 8-char display', async () => {
    token1 = await invited.mutation(anyApi.share.create, {});
    token2 = await invited.mutation(anyApi.share.create, {});
    expect(typeof token1).toBe('string');
    expect(token1).toMatch(TOKEN_RE);
    expect(token2).toMatch(TOKEN_RE);
    expect(token1).not.toBe(token2);

    const links: any[] = await invited.query(anyApi.share.list, {});
    expect(links.length).toBe(2);
    const displays = links.map((l) => l.display).sort();
    expect(displays).toEqual(
      [token1.slice(0, 8), token2.slice(0, 8)].sort()
    );
    const raw = JSON.stringify(links);
    // never a full token or a tokenHash in the returned rows
    expect(raw).not.toContain(token1);
    expect(raw).not.toContain(token2);
    expect(raw).not.toMatch(HEX64_RE);
    for (const l of links) {
      expect(l).toHaveProperty('_id');
      expect(l).toHaveProperty('display');
      expect(l.display.length).toBe(8);
      expect(l).not.toHaveProperty('token');
      expect(l).not.toHaveProperty('tokenHash');
    }
    link1Id = links.find((l) => l.display === token1.slice(0, 8))._id;
    link2Id = links.find((l) => l.display === token2.slice(0, 8))._id;
  });

  test('T-F9 (F7, D7): anonymous share.get returns only {stocks:[{ticker,name,tags}]}', async () => {
    const payload: any = await anonClient().query(anyApi.share.get, {
      token: token1,
    });
    expect(payload).not.toBeNull();
    expect(Object.keys(payload)).toEqual(['stocks']);
    const ownerList: any[] = await invited.query(anyApi.stocks.list, {});
    expect(payload.stocks.length).toBe(ownerList.length);
    for (const s of payload.stocks) {
      expect(Object.keys(s).sort()).toEqual(['name', 'tags', 'ticker']);
    }
    expect(payload.stocks.map((s: any) => s.ticker).sort()).toEqual(
      ownerList.map((s) => s.ticker).sort()
    );
    const raw = JSON.stringify(payload);
    expect(raw).not.toContain('@'); // no emails
    expect(raw).not.toMatch(HEX64_RE); // no hashes
    expect(raw).not.toContain(token1); // no token echo
    expect(raw).not.toContain('_id');
    expect(raw).not.toContain('userId');

    const miss = await anonClient().query(anyApi.share.get, {
      token: 'nope-000000000000000000000000000000',
    });
    expect(miss).toBeNull();
  });

  test('T-F10 (F6, F7): revoke kills exactly that link; admin cannot revoke cross-user', async () => {
    await invited.mutation(anyApi.share.revoke, { id: link1Id });
    expect(
      await anonClient().query(anyApi.share.get, { token: token1 })
    ).toBeNull();
    expect(
      await anonClient().query(anyApi.share.get, { token: token2 })
    ).not.toBeNull();

    await expect(
      admin.mutation(anyApi.share.revoke, { id: link2Id })
    ).rejects.toThrow();
    expect(
      await anonClient().query(anyApi.share.get, { token: token2 })
    ).not.toBeNull();
  });

  test('T-F10b (F6): a second whitelisted non-admin cannot revoke either', async () => {
    await expect(
      other.mutation(anyApi.share.revoke, { id: link2Id })
    ).rejects.toThrow();
    expect(
      await anonClient().query(anyApi.share.get, { token: token2 })
    ).not.toBeNull();
  });

  test('T-F11 (D4, D7): de-whitelisting gates functions AND darkens links; re-invite restores', async () => {
    await admin.mutation(anyApi.whitelist.remove, { email: INVITED });
    await expect(invited.query(anyApi.stocks.list, {})).rejects.toThrow();
    expect(
      await anonClient().query(anyApi.share.get, { token: token2 })
    ).toBeNull();

    await admin.mutation(anyApi.whitelist.add, { email: INVITED });
    const restored: any[] = await invited.query(anyApi.stocks.list, {});
    expect(restored.map((s) => s.ticker).sort()).toEqual(['AAPL', 'MSFT']);
    expect(restored.find((s) => s.ticker === 'AAPL').name).toBe('Apple');
    expect(
      await anonClient().query(anyApi.share.get, { token: token2 })
    ).not.toBeNull();
  });

  test('T-F12 (D10): wrong secret fails sign-in and reset', async () => {
    const c = anonClient();
    let token: string | undefined;
    try {
      const res: any = await c.action(anyApi.auth.signIn, {
        provider: 'test-login',
        params: { email: OUTSIDER, secret: 'wrong-secret' },
      });
      token = res?.tokens?.token;
    } catch {
      token = undefined; // rejecting outright is also a pass
    }
    expect(token, 'wrong secret must not yield a usable token').toBeFalsy();

    await expect(
      anonClient().mutation(anyApi.testing.reset, { secret: 'wrong-secret' })
    ).rejects.toThrow();
  });
});
