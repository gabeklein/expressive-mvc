import './_base/styles.css';

import { BrowserRouter } from '@expressive/router';
import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppModule, Group } from './_base/Examples';

const Examples = lazy(() => import('./_base/Examples'));
const modules = import.meta.glob<AppModule>('../*/**/App.tsx');
const root = createRoot(document.getElementById('root')!);

if (window.self === window.top) {
  const routes = organize(modules);

  root.render(
    <BrowserRouter>
      <Examples routes={routes} />
    </BrowserRouter>
  );
} else {
  const name = window.location.hash.slice(1);
  const file = decodeURIComponent(name);
  const Lazy = lazy(modules[file]);

  root.render(
    <Suspense>
      <Lazy />
    </Suspense>
  )
}

/** Group example modules by their first path segment (`group/example/App.tsx`). */
function organize(modules: Record<string, unknown>): Group[] {
  const groups = new Map<string, Group>();

  for (const file of Object.keys(modules)) {
    const [g, l] = file.split('/').slice(1, -1);
    let group = groups.get(g);

    if (!group)
      groups.set(
        g,
        (group = {
          order: order(g),
          slug: slug(g),
          label: titleCase(slug(g)),
          items: []
        })
      );

    group.items.push({
      order: order(l),
      slug: slug(l) + '/*',
      label: titleCase(slug(l)),
      path: `/${slug(g)}/${slug(l)}`,
      file
    });
  }

  return [...groups.values()]
    .sort(byOrder)
    .map((g) => ({
      ...g,
      items: g.items.sort(byOrder)
    }));
}

function order(seg: string) {
  return +(seg.match(/^(\d+)-/)?.[1] ?? 0);
}

function slug(seg: string) {
  return seg.replace(/^\d+-/, '');
}

function byOrder<T extends { order: number }>(a: T, b: T) {
  return a.order - b.order;
}

function titleCase(str: string) {
  return str
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
