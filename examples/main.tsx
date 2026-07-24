import { ComponentType, lazy, ReactNode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import structure, { type GroupModule } from './structure';

const modules = import.meta.glob<{ default: ComponentType }>('./pages/*/**/App.tsx');
const pages = import.meta.glob<GroupModule>('./pages/**/index.ts', { eager: true });

let app: ReactNode;

if (window.self === window.top) {
  const Shell = lazy(() => import('./app/Shell'));
  const tree = structure(pages, './pages/', modules);

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
