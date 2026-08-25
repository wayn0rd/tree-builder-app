// Stocks functions — spec F2 (caller-only list), F3 (add/update/remove with
// ownership checks), F4 (server-side validation). All gated per §3: reject
// when unauthenticated or not whitelisted (D4).

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireWhitelisted } from './lib/access';
import { validateStockInput } from './lib/validate';

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireWhitelisted(ctx);
    // F2: the caller's own stocks only — no userId argument exists.
    const rows = await ctx.db
      .query('stocks')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      ticker: r.ticker,
      name: r.name,
      tags: r.tags,
    }));
  },
});

export const add = mutation({
  args: {
    ticker: v.string(),
    name: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireWhitelisted(ctx);
    const existing = await ctx.db
      .query('stocks')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    const stock = validateStockInput(args, existing, null); // F4
    const id = await ctx.db.insert('stocks', { userId, ...stock });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id('stocks'),
    ticker: v.string(),
    name: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireWhitelisted(ctx);
    const doc = await ctx.db.get(args.id);
    // F3: only the caller's own document; anything else rejects unchanged.
    if (doc === null || doc.userId !== userId) {
      throw new Error('Stock not found.');
    }
    const existing = await ctx.db
      .query('stocks')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    const stock = validateStockInput(
      { ticker: args.ticker, name: args.name, tags: args.tags },
      existing,
      args.id // F4: edit excludes the stock being edited
    );
    await ctx.db.patch(args.id, stock);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id('stocks') },
  handler: async (ctx, args) => {
    const { userId } = await requireWhitelisted(ctx);
    const doc = await ctx.db.get(args.id);
    if (doc === null || doc.userId !== userId) {
      throw new Error('Stock not found.');
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
