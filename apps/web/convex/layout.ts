import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const tileValidator = v.object({
  sessionId: v.string(),
  x: v.number(),
  y: v.number(),
  w: v.number(),
  h: v.number(),
});

export const getLayout = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query('layouts').collect();
    return all.find((entry) => entry.userId === args.userId) ?? null;
  },
});

export const updateLayout = mutation({
  args: {
    userId: v.string(),
    tiles: v.array(tileValidator),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query('layouts').collect();
    const existing = all.find((entry) => entry.userId === args.userId);
    if (existing) {
      await ctx.db.patch(existing._id, { tiles: args.tiles, updatedAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert('layouts', {
      userId: args.userId,
      tiles: args.tiles,
      updatedAt: Date.now(),
    });
  },
});
