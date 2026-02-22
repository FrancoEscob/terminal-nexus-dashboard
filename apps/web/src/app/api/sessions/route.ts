import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import type { SessionCreateRequest, ApiResponse } from '@/lib/types';
import { validateWorkdir } from '@/lib/types';
import { logRuntimeLifecycle } from '@/lib/runtime-lifecycle-logger';

export async function GET() {
  try {
    logRuntimeLifecycle({
      event: 'api_sessions_list_requested',
      runtime: 'tmux',
      source: 'api/sessions#GET',
    });

    const sessions = sessionManager.getAll();

    logRuntimeLifecycle({
      event: 'api_sessions_list_completed',
      runtime: 'tmux',
      source: 'api/sessions#GET',
      metadata: { count: sessions.length },
    });
    
    return NextResponse.json<ApiResponse>({
      success: true,
      data: sessions.map(session => ({
        id: session.id,
        name: session.name,
        type: session.type,
        workdir: session.workdir,
        command: session.command,
        flags: session.flags,
        status: session.status,
        pid: session.pid,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        exitCode: session.exitCode
      }))
    });
  } catch (error) {
    logRuntimeLifecycle({
      event: 'api_sessions_list_failed',
      runtime: 'tmux',
      status: 'failed',
      source: 'api/sessions#GET',
      reason: error instanceof Error ? error.message : 'Failed to fetch sessions',
      level: 'error',
    });
    console.error('Error fetching sessions:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch sessions'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SessionCreateRequest;

    logRuntimeLifecycle({
      event: 'api_session_create_requested',
      sessionType: body.type,
      runtime: 'tmux',
      status: 'creating',
      source: 'api/sessions#POST',
      metadata: {
        hasName: Boolean(body.name),
      },
    });
    
    // Validate required fields
    if (!body.type || !body.workdir) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: type, workdir'
      }, { status: 400 });
    }

    // Validate workdir path
    let validatedWorkdir: string;
    try {
      validatedWorkdir = validateWorkdir(body.workdir);
    } catch (error) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid workdir',
      }, { status: 400 });
    }
    
    // Create session
    const session = await sessionManager.create({
      ...body,
      workdir: validatedWorkdir
    });

    logRuntimeLifecycle({
      event: 'api_session_create_completed',
      sessionId: session.id,
      sessionType: session.type,
      runtime: 'tmux',
      status: session.status,
      source: 'api/sessions#POST',
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: session.id,
        name: session.name,
        type: session.type,
        workdir: session.workdir,
        command: session.command,
        flags: session.flags,
        status: session.status,
        pid: session.pid,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      },
      message: 'Session created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    logRuntimeLifecycle({
      event: 'api_session_create_failed',
      runtime: 'tmux',
      status: 'failed',
      source: 'api/sessions#POST',
      reason: error instanceof Error ? error.message : 'Failed to create session',
      level: 'error',
    });
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create session'
    }, { status: 500 });
  }
}
