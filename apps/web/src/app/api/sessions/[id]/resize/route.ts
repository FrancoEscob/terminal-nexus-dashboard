import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import type { ApiResponse } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate required fields
    if (!body.cols || !body.rows) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: cols, rows'
      }, { status: 400 });
    }

    // Resize the session
    await sessionManager.resize(id, body.cols, body.rows);

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
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    console.error('Error resizing session:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: message
    }, { status: 500 });
  }
}
