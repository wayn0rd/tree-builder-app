// testing.reset — spec D10: public mutation, enabled ONLY when the Convex
// deployment env var E2E_TEST_SECRET is set (production never sets it, H5).
// Observable contract (amendment 4): after a successful reset, each test
// identity has no app data and no surviving sessions; a subsequent test
// sign-in behaves as a brand-new identity.

import { v } from 'convex/values';
import { mutation } from './_generated/server';
import type { TableNames } from './_generated/dataModel';

export const reset = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    // T-S1 guard: rejected entirely when the env var is unset.
    const secret = process.env.E2E_TEST_SECRET;
    if (!secret) {
      throw new Error('Test mode is not enabled.');
    }
    if (args.secret !== secret) {
      throw new Error('Invalid test secret.');
    }

    // App data (D10: all rows from stocks, whitelist, shareLinks) plus all
    // identities and their auth state, so the next sign-in is brand-new.
    // This is a dev-only deployment wipe by design.
    const tables: TableNames[] = [
      'stocks',
      'whitelist',
      'shareLinks',
      'authSessions',
      'authRefreshTokens',
      'authAccounts',
      'authVerificationCodes',
      'authVerifiers',
      'authRateLimits',
      'users',
    ];
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }
    return null;
  },
});
