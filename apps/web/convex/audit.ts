import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const addAuditLog = mutation({
  args: {
    actor: v.union(v.literal('fran'), v.literal('jarvix')),
    action: v.union(v.literal('created'), v.literal('killed'), v.literal('typed'), v.literal('resized'), v.literal('restarted')),
    sessionId: v.string(),
    metadata: v.optional(
      v.object({
        command: v.optional(v.string()),
        exitCode: v.optional(v.number()),
        workdir: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('auditLogs', {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getAuditLogs = query({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const logs = await ctx.db.query('auditLogs').collect();
    const filtered = args.sessionId ? logs.filter((log) => log.sessionId === args.sessionId) : logs;
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  },
});
