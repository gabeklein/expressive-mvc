import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import { home, loadFrame, tree } from './pages';

const root = createRoot(document.getElementById('root')!);

if (window.self === window.top) {
  const Shell = lazy(() => import('./app/Shell'));
  root.render(
    <Suspense>
      <Shell tree={tree} default={home} />
    </Suspense>
  );
} else {
  // Centers/constrains example content; the shell (top window) opts out.
  // Theme is pushed in directly by the shell (see Outlet).
  document.body.classList.add('example');

  // Await the module so render commits promptly.
  const { default: Example } = await loadFrame()();

  root.render(
    <Suspense>
      <Example />
    </Suspense>
  );

  // The shell covers this iframe until this event 
  // so document's load never flashes white.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.parent.postMessage('example:ready', '*')
  }));
}