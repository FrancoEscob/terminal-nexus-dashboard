import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse, SessionUpdateRequest } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await sessionManager.ensureActiveSession(id);
    const [persistedSession] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    
    if (!session && !persistedSession) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    const sessionData = session ?? {
      id,
      name: persistedSession!.name,
      type: persistedSession!.type,
      workdir: persistedSession!.workdir,
      command: persistedSession!.command,
      flags: (() => {
        try {
          return JSON.parse(persistedSession!.flags || '[]') as string[];
        } catch {
          return [];
        }
      })(),
      status: persistedSession!.status,
      pid: persistedSession!.pid || undefined,
      createdAt: persistedSession!.createdAt,
      updatedAt: persistedSession!.updatedAt,
      exitCode: persistedSession!.exitCode ?? undefined,
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: sessionData.id,
        name: sessionData.name,
        type: sessionData.type,
        workdir: sessionData.workdir,
        command: sessionData.command,
        flags: sessionData.flags,
        status: sessionData.status,
        pid: sessionData.pid,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        exitCode: sessionData.exitCode
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch session'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Kill the session
    await sessionManager.kill(id);

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Session killed successfully'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to kill session';
    if (message.includes('Session not found')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    console.error('Error killing session:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json() as SessionUpdateRequest;

    // Handle resize
    if (body.cols && body.rows) {
      await sessionManager.resize(id, body.cols, body.rows);
    }

    // Handle name update (TODO: Implement in SessionManager)
    if (body.name) {
      // Would need to implement rename functionality
      console.log('Rename not implemented yet');
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Session updated successfully'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update session';
    if (message.includes('Session not found')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    console.error('Error updating session:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message
    }, { status: 500 });
  }
}
