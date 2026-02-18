import { z } from 'zod'

export const SessionTypeSchema = z.enum(['claude', 'droid', 'shell'])
export type SessionType = z.infer<typeof SessionTypeSchema>

export const SessionStatusSchema = z.enum(['running', 'stopped', 'error'])
export type SessionStatus = z.infer<typeof SessionStatusSchema>

export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: SessionTypeSchema,
  status: SessionStatusSchema,
  workdir: z.string(),
  createdAt: z.string(),
  pid: z.number().optional(),
  socketPath: z.string(),
  metadata: z.object({
    command: z.string(),
    flags: z.array(z.string()),
    pid: z.number(),
  }).optional(),
})

export type Session = z.infer<typeof SessionSchema>

export const CreateSessionRequestSchema = z.object({
  type: SessionTypeSchema,
  workdir: z.string(),
  name: z.string().optional(),
  flags: z.array(z.string()).optional(),
  command: z.string().optional(),
})

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>

// WebSocket Events
export interface ServerToClientEvents {
  'terminal:output': (sessionId: string, data: string) => void
  'terminal:status': (sessionId: string, status: SessionStatus) => void
  'terminal:exited': (sessionId: string, exitCode: number) => void
  'session:list': (sessions: Session[]) => void
}

export interface ClientToServerEvents {
  'terminal:join': (sessionId: string) => void
  'terminal:leave': (sessionId: string) => void
  'terminal:input': (sessionId: string, data: string) => void
  'terminal:resize': (sessionId: string, cols: number, rows: number) => void
}
