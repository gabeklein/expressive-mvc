import { ComponentType, lazy, ReactNode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import structure, { type GroupModule } from './structure';

const modules = import.meta.glob<{ default: ComponentType }>('./content/*/**/App.tsx');

let app: ReactNode;

if (window.self === window.top) {
  const Shell = lazy(() => import('./app/Shell'));

  const order = Object.values(
    import.meta.glob<string[]>('./content/index.ts', { eager: true, import: 'default' })
  )[0];

  const manifests: Record<string, GroupModule> = {};

  for (const [path, m] of Object.entries(
    import.meta.glob<GroupModule>('./content/*/index.ts', { eager: true })
  ))
    manifests[path.split('/').at(-2)!] = m;

  app = <Shell modules={modules} groups={structure(order, manifests)} />;
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
