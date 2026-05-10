import './_base/styles.css';

import { Component } from '@expressive/react';
import { type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

type AppModule = { default: ComponentType };
type Example = { path: string; title: string; load: () => Promise<AppModule> };

const here = () => window.location.pathname.replace(/\/+$/, '') || '/';

const modules = import.meta.glob<AppModule>('./*/**/App.tsx');
const examples: Example[] = Object.entries(modules)
  .map(([file, load]): Example => {
    const segments = file.split('/').slice(1, -1).map((p) => p.replace(/^\d+-/, ''));
    return {
      path: '/' + segments.join('/'),
      title: segments.map((p) => p.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')).join(' / '),
      load
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

class Examples extends Component {
  url = here();

  get current(): Example | undefined {
    return examples.find((e) => e.path === this.url);
  }

  protected new() {
    const update = () => this.url = here();

    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }

  navigate(e: React.MouseEvent<HTMLAnchorElement>){
    e.preventDefault();
    this.url = e.currentTarget.getAttribute('href')!;
    window.history.pushState(null, '', this.url);
  };

  render(){
    const { current, navigate, url } = this;

    return (
      <>
        <nav className="dev-nav">
          {examples.map((e) => (
            <a
              key={e.path}
              href={e.path}
              onClick={navigate}
              aria-current={e === current ? 'page' : undefined}>
              {e.title}
            </a>
          ))}
        </nav>
        {current ? (
          <iframe
            key={current.path}
            className="dev-frame"
            src={current.path}
            title={current.title}
          />
        ) : (
          <NotFound path={url} />
        )}
      </>
    );
  }
}

const root = createRoot(document.getElementById('root')!);

if (window.self === window.top) {
  root.render(<Examples />);
} else {
  const entry = examples.find((e) => e.path === here());

  if (entry)
    entry.load().then((mod) => root.render(<mod.default />));
}

function NotFound({ path }: { path: string }){
  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <h1>404</h1>
      <p>No example matches <code>{path}</code>.</p>
    </div>
  );
}
