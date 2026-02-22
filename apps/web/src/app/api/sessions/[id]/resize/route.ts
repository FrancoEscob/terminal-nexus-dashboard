import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import type { ApiResponse } from '@/lib/types';
import { logRuntimeLifecycle } from '@/lib/runtime-lifecycle-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    logRuntimeLifecycle({
      event: 'api_session_resize_requested',
      sessionId: id,
      runtime: 'tmux',
      source: 'api/sessions/[id]/resize#POST',
      metadata: {
        cols: body?.cols,
        rows: body?.rows,
      },
    });
    
    // Validate required fields
    if (!body.cols || !body.rows) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: cols, rows'
      }, { status: 400 });
    }

    // Resize the session
    await sessionManager.resize(id, body.cols, body.rows);

    logRuntimeLifecycle({
      event: 'api_session_resize_completed',
      sessionId: id,
      runtime: 'tmux',
      source: 'api/sessions/[id]/resize#POST',
      metadata: {
        cols: body.cols,
        rows: body.rows,
      },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Session resized successfully',
      data: {
        cols: body.cols,
        rows: body.rows
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resize session';
    if (message.includes('Session not found')) {
      logRuntimeLifecycle({
        event: 'api_session_resize_missing',
        sessionId: (await params).id,
        runtime: 'tmux',
        source: 'api/sessions/[id]/resize#POST',
        reason: message,
        level: 'warn',
      });

      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    logRuntimeLifecycle({
      event: 'api_session_resize_failed',
      runtime: 'tmux',
      status: 'failed',
      source: 'api/sessions/[id]/resize#POST',
      reason: message,
      level: 'error',
    });
    console.error('Error resizing session:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message
    }, { status: 500 });
  }
}
