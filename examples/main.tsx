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

  // The iframe is its own document, so the shell's theme toggle doesn't
  // reach it. Mirror the saved mode here and follow the shell's writes
  // (storage events fire cross-document on the same origin).
  const KEY = 'expressive-examples-theme';
  const syncTheme = () => {
    const { dataset } = document.documentElement;
    let mode: string | null = null;

    try {
      mode = localStorage.getItem(KEY);
    } catch {}

    if (mode === 'light' || mode === 'dark') dataset.theme = mode;
    else delete dataset.theme;
  };

  syncTheme();
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) syncTheme();
  });

  app = <Example />;
}

createRoot(document.getElementById('root')!).render(
  <Suspense>{app}</Suspense>
);
