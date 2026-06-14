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
  const file = decodeURIComponent(name);
  const Example = lazy(modules[file]);

  app = <Example />;
}

createRoot(document.getElementById('root')!).render(
  <Suspense>{app}</Suspense>
);
