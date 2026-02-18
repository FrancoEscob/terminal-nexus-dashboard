import { NextResponse } from 'next/server'
import { sessionManager } from '@/lib/session-manager'

export async function GET() {
  try {
    const activeSessions = sessionManager.getAll();
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      phase: '1 - Backend Core',
      message: 'Terminal Nexus Dashboard - Backend Core implemented',
      backend: {
        sessionManager: 'initialized',
        activeSessions: activeSessions.length,
        tmuxWrapper: 'ready',
        socketIO: 'configured'
      }
    })
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
