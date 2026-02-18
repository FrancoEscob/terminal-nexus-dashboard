import type { NextApiRequest, NextApiResponse } from 'next';
import { SocketHandler as SocketIOHandler } from '@/lib/socket-server';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return SocketIOHandler(req, res as NextApiResponse & { socket: any });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
