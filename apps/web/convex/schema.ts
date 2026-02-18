import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Quién está viendo qué terminal
  presence: defineTable({
    userId: v.string(),
    sessionId: v.optional(v.id("sessions")),
    status: v.union(v.literal("active"), v.literal("idle")),
    lastSeen: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"]),

  // Layout del grid (sync entre tabs)
  layouts: defineTable({
    userId: v.string(),
    tiles: v.array(v.object({
      sessionId: v.string(),
      x: v.number(),
      y: v.number(),
      w: v.number(),
      h: v.number(),
    })),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Audit log: quién hizo qué
  auditLogs: defineTable({
    actor: v.union(v.literal("fran"), v.literal("jarvix")),
    action: v.union(
      v.literal("created"),
      v.literal("killed"),
      v.literal("typed"),
      v.literal("resized"),
      v.literal("restarted")
    ),
    sessionId: v.string(),
    metadata: v.optional(v.object({
      command: v.optional(v.string()),
      exitCode: v.optional(v.number()),
      workdir: v.optional(v.string()),
    })),
    timestamp: v.number(),
  }).index("by_session", ["sessionId"]),

  // Templates de sesiones
  templates: defineTable({
    name: v.string(),
    type: v.union(v.literal("claude"), v.literal("droid"), v.literal("shell")),
    workdir: v.optional(v.string()),
    flags: v.optional(v.array(v.string())),
    command: v.optional(v.string()),
    createdBy: v.string(),
    shared: v.boolean(),
  }).index("by_creator", ["createdBy"]),

  // Historial de comandos (para search/autocomplete)
  commandHistory: defineTable({
    sessionId: v.string(),
    command: v.string(),
    output: v.optional(v.string()),
    exitCode: v.optional(v.number()),
    timestamp: v.number(),
  }).index("by_session", ["sessionId"]),

  // Notificaciones
  notifications: defineTable({
    userId: v.string(),
    type: v.union(v.literal("session_ended"), v.literal("error")),
    sessionId: v.string(),
    message: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
