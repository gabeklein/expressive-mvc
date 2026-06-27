import './_layout/styles.css';

import { ComponentType, lazy, ReactNode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

const modules = import.meta.glob<{ default: ComponentType }>('../*/**/App.tsx');

let app: ReactNode;

if (window.self === window.top) {
  const Examples = lazy(() => import('./_layout/Examples'));

  app = <Examples modules={modules} />;
} else {
  const name = window.location.hash.slice(1);
  const Example = lazy(modules[decodeURIComponent(name)]);

  // Centers/constrains example content; the shell (top window) opts out.
  document.body.classList.add('example');

  app = <Example />;
}

createRoot(document.getElementById('root')!).render(
  <Suspense>{app}</Suspense>
);
