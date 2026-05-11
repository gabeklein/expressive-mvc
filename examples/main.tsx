import './_base/styles.css';

import { lazy, Suspense, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppModule } from './_base/Examples';

const Examples = lazy(() => import('./_base/Examples'));
const modules = import.meta.glob<AppModule>('../*/**/App.tsx');

let App: ComponentType;

if (window.self === window.top) {
  App = () => <Examples modules={modules} />;
} else {
  const file = decodeURIComponent(window.location.hash);
  App = lazy(modules[file.slice(1)]);
}

createRoot(document.getElementById('root')!).render(
  <Suspense>
    <App />
  </Suspense>
);
