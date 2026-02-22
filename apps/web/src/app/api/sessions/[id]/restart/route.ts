import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse, SessionCreateRequest } from '@/lib/types';
import { logRuntimeLifecycle } from '@/lib/runtime-lifecycle-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    logRuntimeLifecycle({
      event: 'api_session_restart_requested',
      sessionId: id,
      runtime: 'tmux',
      source: 'api/sessions/[id]/restart#POST',
    });

    const [persistedSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (!persistedSession) {
      logRuntimeLifecycle({
        event: 'api_session_restart_missing',
        sessionId: id,
        runtime: 'tmux',
        source: 'api/sessions/[id]/restart#POST',
        reason: 'session_not_found',
        level: 'warn',
      });

      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    const activeSession = await sessionManager.ensureActiveSession(id);
    const sessionType = (activeSession?.type ?? persistedSession.type) as SessionCreateRequest['type'];
    const parsedFlags = (() => {
      if (activeSession) return activeSession.flags;
      try {
        return JSON.parse(persistedSession.flags || '[]') as string[];
      } catch {
        return [];
      }
    })();

    // Store session config while keeping the same id/socket path so clients stay attached
    const sessionConfig = {
      id,
      socketPath: activeSession?.socketPath ?? persistedSession.socketPath,
      type: sessionType,
      workdir: activeSession?.workdir ?? persistedSession.workdir,
      name: activeSession?.name ?? persistedSession.name,
      command: sessionType === 'shell' ? (activeSession?.command ?? persistedSession.command) : undefined,
      flags: parsedFlags,
      cols: 80,
      rows: 24
    };

    // Kill current session
    await sessionManager.kill(id);

    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create new session with same config
    const newSession = await sessionManager.create(sessionConfig);

    logRuntimeLifecycle({
      event: 'api_session_restart_completed',
      sessionId: newSession.id,
      sessionType: newSession.type,
      runtime: 'tmux',
      status: newSession.status,
      source: 'api/sessions/[id]/restart#POST',
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Session restarted successfully',
      data: {
        id: newSession.id,
        name: newSession.name,
        type: newSession.type,
        workdir: newSession.workdir,
        command: newSession.command,
        flags: newSession.flags,
        status: newSession.status,
        pid: newSession.pid,
        createdAt: newSession.createdAt,
        updatedAt: newSession.updatedAt
      }
    });
  } catch (error) {
    logRuntimeLifecycle({
      event: 'api_session_restart_failed',
      runtime: 'tmux',
      status: 'failed',
      source: 'api/sessions/[id]/restart#POST',
      reason: error instanceof Error ? error.message : 'Failed to restart session',
      level: 'error',
    });
    console.error('Error restarting session:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restart session'
    }, { status: 500 });
  }
}
