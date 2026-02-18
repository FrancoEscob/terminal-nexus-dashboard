import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import type { ApiResponse, SessionUpdateRequest } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = sessionManager.get(id);
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

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
        updatedAt: session.updatedAt,
        exitCode: session.exitCode
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
    
    // Check if session exists
    const session = sessionManager.get(id);
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    // Kill the session
    await sessionManager.kill(id);

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Session killed successfully'
    });
  } catch (error) {
    console.error('Error killing session:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to kill session'
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json() as SessionUpdateRequest;
    
    // Check if session exists
    const session = sessionManager.get(id);
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

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
    console.error('Error updating session:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update session'
    }, { status: 500 });
  }
}
