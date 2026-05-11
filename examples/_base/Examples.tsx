import { Component } from '@expressive/react';
import { NotFound } from './NotFound';
import { type ComponentType } from 'react';

export type AppModule = { default: ComponentType };

type Example = {
  path: string;
  file: string;
  order: number
  title: string;
  load: () => Promise<AppModule>;
};

export const here = () => window.location.pathname.replace(/\/+$/, '') || '/';

class Examples extends Component {
  modules: Record<string, () => Promise<AppModule>> = {};
  url = here();
  
  get examples() {
    return Object
      .entries(this.modules)
      .map(([file, load]): Example => {
        let order = 0;
        const segments = file.split('/').slice(1, -1).map((p) => {
          const match = p.match(/^(\d+)-/);
          if (match) order = parseInt(match[1], 10);
          return p.replace(/^\d+-/, '')
        });
        return {
          order,
          file,
          path: '/' + segments.join('/'),
          title: segments.map((p) => p.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')).join(' / '),
          load
        };
      })
      .sort((a, b) => a.order - b.order);
  }

  get current(): Example | undefined {
    return this.examples.find((e) => e.path === this.url);
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
          {this.examples.map((e) => (
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
            title={current.title}
            src={`module#${encodeURIComponent(current.file)}`}
          />
        ) : (
          <NotFound path={url} />
        )}
      </>
    );
  }
}

export default Examples;