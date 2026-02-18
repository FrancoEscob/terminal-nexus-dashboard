import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['claude', 'droid', 'shell'] }).notNull(),
  workdir: text('workdir').notNull(),
  socketPath: text('socket_path').notNull(),
  command: text('command').notNull(),
  flags: text('flags'), // JSON string
  pid: integer('pid'),
  status: text('status', { enum: ['running', 'stopped', 'error'] }).notNull(),
  exitCode: integer('exit_code'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const logs = sqliteTable('logs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  sessionId: text('session_id'),
  data: text('data').notNull(), // base64 encoded
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Log = typeof logs.$inferSelect
export type NewLog = typeof logs.$inferInsert
