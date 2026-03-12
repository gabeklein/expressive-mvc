'use client';
import type { PropsWithChildren } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/waku';

export function Provider({ children }: PropsWithChildren) {
  return <RootProvider>{children}</RootProvider>;
}
