import './_base/styles.css';

import { useEffect, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

const toSlug = (path: string) => path.split('/').slice(1, -1).map((p) => p.replace(/^\d+-/, '')).join('/');
const totitle = (slug: string) =>
  slug
    .split('/')
    .map((p) => p.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '))
    .join(' / ');

type AppModule = { default: ComponentType };
const modules = import.meta.glob<AppModule>('./*/**/App.tsx', { eager: true });
const styles = import.meta.glob<string>('./*/**/App.css', {
  query: '?raw',
  import: 'default',
  eager: true
});

const cssBySlug: Record<string, string> = {};

for (const [path, css] of Object.entries(styles)) {
  cssBySlug[toSlug(path)] = css;
}

const examples = Object.entries(modules)
  .map(([path, mod]) => {
    const slug = toSlug(path);
    return { slug, title: totitle(slug), App: mod.default, css: cssBySlug[slug] };
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

const getRoute = () => {
  const slug = window.location.hash.replace(/^#\/?/, '');
  return examples.find((e) => e.slug === slug) ?? examples[0];
};

const Shell = () => {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const { App, css } = route;

  return (
    <>
      {css && <style>{css}</style>}
      <nav className="dev-nav">
        {examples.map((e) => (
          <a
            key={e.slug}
            href={`#/${e.slug}`}
            aria-current={e.slug === route.slug ? 'page' : undefined}
          >
            {e.title}
          </a>
        ))}
      </nav>
      <main className="dev-content">
        <App />
      </main>
    </>
  );
};

createRoot(document.getElementById('root')!).render(<Shell />);
