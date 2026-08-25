// Share-link functions — spec D7 (hashed tokens, revoke = delete), F6
// (create/list/revoke), F7 (public share.get).

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import {
  ADMIN_EMAIL,
  normalizeEmail,
  requireWhitelisted,
} from './lib/access';
import { sha256Hex } from './lib/sha256';

const BASE64URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * D7: plaintext token from a CSPRNG with ≥ 128 bits of entropy, rendered as
 * ≥ 32 URL-safe characters. 24 random bytes (192 bits) → 32 base64url chars
 * with no padding.
 */
function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      BASE64URL_ALPHABET[(n >>> 18) & 63] +
      BASE64URL_ALPHABET[(n >>> 12) & 63] +
      BASE64URL_ALPHABET[(n >>> 6) & 63] +
      BASE64URL_ALPHABET[n & 63];
  }
  return out;
}

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireWhitelisted(ctx);
    const token = generateToken();
    // S3/D7: only the SHA-256 hash is persisted, plus the 8-char shortened
    // display identifier (non-authoritative, F6/U5). Never the plaintext.
    await ctx.db.insert('shareLinks', {
      userId,
      tokenHash: sha256Hex(token),
      display: token.slice(0, 8),
    });
    // F6: the plaintext token is returned exactly once, here.
    return token;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireWhitelisted(ctx);
    const rows = await ctx.db
      .query('shareLinks')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    // F6: never the full token or tokenHash — only the shortened display id.
    return rows.map((r) => ({ _id: r._id, display: r.display }));
  },
});

export const revoke = mutation({
  args: { id: v.id('shareLinks') },
  handler: async (ctx, args) => {
    const { userId } = await requireWhitelisted(ctx);
    const doc = await ctx.db.get(args.id);
    // F6: an id not owned by the caller rejects (even for the admin).
    if (doc === null || doc.userId !== userId) {
      throw new Error('Share link not found.');
    }
    await ctx.db.delete(args.id); // D7: revoke = delete the row
    return null;
  },
});

// F7: public, no auth required — the anonymous shared page's data source.
export const get = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = sha256Hex(args.token);
    const link = await ctx.db
      .query('shareLinks')
      .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
      .unique();
    if (link === null) return null; // unknown or revoked (row deleted)

    // D7: links go dark while the owner is off the whitelist (admin exempt).
    const owner = await ctx.db.get(link.userId);
    if (owner === null) return null;
    const email = normalizeEmail(owner.email ?? '');
    const isAdmin = email !== '' && email === ADMIN_EMAIL;
    if (!isAdmin) {
      if (email === '') return null;
      const row = await ctx.db
        .query('whitelist')
        .withIndex('by_email', (q) => q.eq('email', email))
        .unique();
      if (row === null) return null;
    }

    const stocks = await ctx.db
      .query('stocks')
      .withIndex('by_userId', (q) => q.eq('userId', link.userId))
      .collect();
    // D7/F7: payload is ONLY { stocks: [{ ticker, name, tags }] } — no ids,
    // no emails, no hashes, no owner identity.
    return {
      stocks: stocks.map((s) => ({
        ticker: s.ticker,
        name: s.name,
        tags: s.tags,
      })),
    };
  },
});
