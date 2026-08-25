// Convex schema — spec .loopzai/spec.md §2 (S1–S4).
// No ownership/portfolio fields anywhere (S1, N5); shareLinks stores only
// tokenHash, never the plaintext token (S3, D7).

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

export default defineSchema({
  ...authTables,

  // S1: per-user stocks; ticker stored uppercase, tags non-empty (F4).
  stocks: defineTable({
    userId: v.id('users'),
    ticker: v.string(),
    name: v.string(),
    tags: v.array(v.string()),
  }).index('by_userId', ['userId']),

  // S2: whitelist of emails, stored trimmed + lowercased; at most one row
  // per email (whitelist.add is idempotent).
  whitelist: defineTable({
    email: v.string(),
  }).index('by_email', ['email']),

  // S3: share links; tokenHash = SHA-256 hex of the plaintext token (D7).
  // `display` is the non-authoritative shortened identifier (token's first
  // 8 chars, captured at creation per F6/U5) — never the plaintext token.
  shareLinks: defineTable({
    userId: v.id('users'),
    tokenHash: v.string(),
    display: v.string(),
  })
    .index('by_tokenHash', ['tokenHash'])
    .index('by_userId', ['userId']),
});
