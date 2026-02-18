import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const updatePresence = mutation({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('idle')),
  },
  handler: async (ctx, args) => {
    const allPresence = await ctx.db.query('presence').collect();
    const existing = allPresence.find((entry) => entry.userId === args.userId);

    if (existing) {
      await ctx.db.patch(existing._id, {
        sessionId: args.sessionId,
        status: args.status,
        lastSeen: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('presence', {
      userId: args.userId,
      sessionId: args.sessionId,
      status: args.status,
      lastSeen: Date.now(),
    });
  },
});

export const getSessionPresence = query({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query('presence').collect();
    if (!args.sessionId) return all;
    return all.filter((entry) => entry.sessionId === args.sessionId);
  },
});
