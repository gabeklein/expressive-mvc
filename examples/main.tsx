import { lazy, ReactNode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import { home, loadFrame, tree } from './pages';

let app: ReactNode;

if (window.self === window.top) {
  const Shell = lazy(() => import('./app/Shell'));
  app = <Shell tree={tree} default={home} />;
} else {
  const Example = lazy(loadFrame());

  // Centers/constrains example content; the shell (top window) opts out.
  // Theme is pushed in directly by the shell (see Outlet).
  document.body.classList.add('example');

  app = <Example />;
}

createRoot(document.getElementById('root')!).render(
  <Suspense>{app}</Suspense>
);
