export interface PresenceEntry {
  userId: string;
  sessionId?: string;
  status: 'active' | 'idle';
  lastSeen: number;
}

export interface LayoutTile {
  sessionId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AuditLogEntry {
  actor: 'fran' | 'jarvix';
  action: 'created' | 'killed' | 'typed' | 'resized' | 'restarted';
  sessionId: string;
  metadata?: {
    command?: string;
    exitCode?: number;
    workdir?: string;
  };
  timestamp: number;
}
