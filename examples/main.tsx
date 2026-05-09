import './_base/styles.css';

import State from '@expressive/react';
import { type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

const toSlug = (path: string) => path.split('/').slice(1, -1).map((p) => p.replace(/^\d+-/, '')).join('/');
const totitle = (slug: string) =>
  slug
    .split('/')
    .map((p) => p.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '))
    .join(' / ');

type AppModule = { default: ComponentType };
type Example = { App: ComponentType; css?: string; slug: string; title: string };

const modules = import.meta.glob<AppModule>('./*/**/App.tsx', { eager: true });
const styles = import.meta.glob<string>('./*/**/App.css', {
  query: '?raw',
  import: 'default',
  eager: true
});

class Router extends State {
  hash = '';

  examples = Object.entries(modules)
    .map(([path, mod]): Example => {
      const slug = toSlug(path);
      const css = styles[path.replace(/App\.tsx$/, 'App.css')];
      return { App: mod.default, css, slug, title: totitle(slug) };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  get current() {
    return this.examples.find((e) => e.slug === this.hash) ?? this.examples[0];
  }

  protected new() {
    const update = () => {
      this.hash = window.location.hash.replace(/^#\/?/, '') || this.examples[0].slug;
    };

    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }
}

const Shell = () => {
  const { current, examples } = Router.use();
  const { App, css } = current;

  return (
    <>
      <nav className="dev-nav">
        {examples.map((e) => (
          <a
            key={e.slug}
            href={`#/${e.slug}`}
            aria-current={e === current ? 'page' : undefined}>
            {e.title}
          </a>
        ))}
      </nav>
      <main className="dev-content">
        {css && <style>{css}</style>}
        <App />
      </main>
    </>
  );
};

createRoot(document.getElementById('root')!).render(<Shell />);
