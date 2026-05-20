import { Component } from '@expressive/react';
import { NotFound } from './NotFound';
import { type ComponentType } from 'react';
import Logo from './Logo';
import styles from './Examples.module.css';

export type AppModule = { default: ComponentType };

type Example = {
  path: string;
  file: string;
  order: number;
  title: string;
  load: () => Promise<AppModule>;
};

class Examples extends Component {
  modules: Record<string, () => Promise<AppModule>> = {};
  url = here();

  get examples() {
    return Object.entries(this.modules)
      .map(([file, load]): Example => {
        let order = 0;
        const segments = file
          .split('/')
          .slice(1, -1)
          .map((p) => {
            const match = p.match(/^(\d+)-/);
            if (match) order = parseInt(match[1], 10);
            return p.replace(/^\d+-/, '');
          });

        return {
          order,
          file,
          path: '/' + segments.join('/'),
          title: segments.map(titleCase).join(' / '),
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

  navigate(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    this.url = e.currentTarget.getAttribute('href')!;
    window.history.pushState(null, '', this.url);
  }

  render() {
    return (
      <main className={styles.shell}>
        <Navigation />
        <Frame />
      </main>
    );
  }
}

const Frame = () => {
  const { current, url } = Examples.get();

  return (
    <section className={styles.example}>
      {current ? (
        <iframe
          key={current.path}
          className={styles.frame}
          title={current.title}
          src={`module#${encodeURIComponent(current.file)}`}
        />
      ) : (
        <NotFound path={url} />
      )}
    </section>
  );
};

const Navigation = () => {
  const { is: control, current, examples } = Examples.get();

  return (
    <nav className={styles.nav}>
      <a className={styles.logo} href="/">
        <Logo />
      </a>
      <div className={styles.links}>
        {examples.map((e) => (
          <a
            key={e.path}
            href={e.path}
            onClick={(evt) => {
              evt.preventDefault();
              control.url = e.path;
              window.history.pushState(null, '', e.path);
            }}
            aria-current={e === current ? 'page' : undefined}>
            {e.title}
          </a>
        ))}
      </div>
    </nav>
  );
};

function here() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function titleCase(str: string) {
  return str
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export default Examples;
