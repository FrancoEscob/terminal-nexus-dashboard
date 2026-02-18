'use client';

import { usePresenceTracker } from '@/hooks/use-presence';

export function AppPresenceTracker() {
  usePresenceTracker();
  return null;
}
