import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import type { SessionCreateRequest, ApiResponse } from '@/lib/types';
import { validateWorkdir } from '@/lib/types';

export async function GET() {
  try {
    const sessions = sessionManager.getAll();
    
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
    
    // Validate required fields
    if (!body.type || !body.workdir) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: type, workdir'
      }, { status: 400 });
    }

    // Validate workdir path
    const validatedWorkdir = validateWorkdir(body.workdir);
    
    // Create session
    const session = await sessionManager.create({
      ...body,
      workdir: validatedWorkdir
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
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create session'
    }, { status: 500 });
  }
}
