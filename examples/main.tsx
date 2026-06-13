import './_layout/styles.css';

import { ComponentType, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

const modules = import.meta.glob<{ default: ComponentType }>('../*/**/App.tsx');
const root = createRoot(document.getElementById('root')!);

if (window.self === window.top) {
  const Examples = lazy(() => import('./_layout/Examples'));

  root.render(<Examples modules={modules} />);
} else {
  const name = window.location.hash.slice(1);
  const file = decodeURIComponent(name);
  const Example = lazy(modules[file]);

  // Centers/constrains example content; the shell (top window) opts out.
  document.body.classList.add('example');

  root.render(
    <Suspense>
      <Example />
    </Suspense>
  );
}
