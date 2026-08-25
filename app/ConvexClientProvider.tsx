'use client';

// Convex + Convex Auth client provider — spec §8 M1 (client provider wiring).

import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { ReactNode } from 'react';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL as string);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
