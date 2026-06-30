import "@expressive/react";

import { ComponentType, lazy, ReactNode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import structure, { leaves, type GroupModule } from './structure';

const modules = import.meta.glob<{ default: ComponentType }>('./content/*/**/App.tsx');

let app: ReactNode;

if (window.self === window.top) {
  const Shell = lazy(() => import('./app/Shell'));

  const manifests = Object.fromEntries(
    Object.entries(import.meta.glob<GroupModule>('./content/**/index.ts', { eager: true }))
      .map(([path, m]) => [path.replace(/^\.\/content\//, '').replace(/\/?index\.ts$/, ''), m] as const)
  );

  const tree = structure(manifests);

  // Each leaf's lazy module key doubles as its iframe src.
  for (const leaf of leaves(tree)) {
    const file = `./content/${leaf.path}/App.tsx`;
    if (file in modules) leaf.file = file;
  }

  app = <Shell tree={tree} />;
} else {
  const name = window.location.hash.slice(1);
  const Example = lazy(modules[decodeURIComponent(name)]);

  // Centers/constrains example content; the shell (top window) opts out.
  // Theme is pushed in directly by the shell (see Outlet).
  document.body.classList.add('example');

  app = <Example />;
}

createRoot(document.getElementById('root')!).render(
  <Suspense>{app}</Suspense>
);
