// Whitelist functions — spec F5 (admin-only list/add/remove), S2 (stored
// trimmed + lowercased, idempotent add), D6 (internal seed).

import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { normalizeEmail, requireAdmin } from './lib/access';

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query('whitelist').collect();
    return rows.map((r) => ({ _id: r._id, email: r.email }));
  },
});

export const add = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error('Email is required.');
    }
    // S2/F5: idempotent — adding an existing email succeeds and leaves
    // exactly one row.
    const existing = await ctx.db
      .query('whitelist')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    if (existing === null) {
      await ctx.db.insert('whitelist', { email });
    }
    return null;
  },
});

export const remove = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const email = normalizeEmail(args.email); // case-insensitive match (F5)
    const existing = await ctx.db
      .query('whitelist')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

// D6: callable only via `npx convex run` (internal — not part of the client
// API). Inserts waynehoy@gmail.com if absent; the admin email is NOT stored
// (implicit per D3).
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const email = 'waynehoy@gmail.com';
    const existing = await ctx.db
      .query('whitelist')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    if (existing === null) {
      await ctx.db.insert('whitelist', { email });
    }
    return null;
  },
});
