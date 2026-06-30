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

  const manifests = Object.fromEntries(
    Object.entries(import.meta.glob<GroupModule>('./content/*/index.ts', { eager: true }))
      .map(([path, m]) => [path.split('/').at(-2)!, m] as const)
  );

  // Each example's lazy module key doubles as its iframe src.
  const groups = structure(order, manifests).map((g) => ({
    ...g,
    items: g.items.map((e) => {
      const file = `./content/${e.group}/${e.slug}/App.tsx`;
      return { ...e, file: file in modules ? file : undefined };
    })
  }));

  app = <Shell groups={groups} />;
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
