'use client';

import { ConvexReactClient } from 'convex/react';
import { ConvexProvider } from 'convex/react';
import { ReactNode, useEffect, useState } from 'react';

interface ConvexClientProviderProps {
  children: ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [client, setClient] = useState<ConvexReactClient | null>(null);

  useEffect(() => {
    if (!convexUrl) {
      setClient(null);
      return;
    }

    setClient(new ConvexReactClient(convexUrl));
  }, [convexUrl]);

  if (!client) {
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
