import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Socket.io transport is served from /api/socket-io',
  });
}
