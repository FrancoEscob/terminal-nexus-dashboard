import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Get current session details
    const currentSession = sessionManager.get(id);
    if (!currentSession) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    // Store session config
    const sessionConfig = {
      type: currentSession.type,
      workdir: currentSession.workdir,
      name: currentSession.name,
      command: currentSession.type === 'shell' ? currentSession.command.split(' ').slice(1).join(' ') : undefined,
      flags: currentSession.flags,
      cols: 80,
      rows: 24
    };

    // Kill current session
    await sessionManager.kill(id);

    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create new session with same config
    const newSession = await sessionManager.create(sessionConfig);

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
    console.error('Error restarting session:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restart session'
    }, { status: 500 });
  }
}
