import { Component } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';
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
  router = new Router();

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
    const { match } = this.router;
    return this.examples.find((e) => match('', e.path));
  }

  render() {
    const [first] = this.examples;
    return (
      <Route>
        {first && <Route to="" redirect={first.path} />}
        <main className={styles.shell}>
          <Navigation />
          <Frame />
        </main>
      </Route>
    );
  }
}

const Frame = () => {
  const { current, router } = Examples.get();

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
        <NotFound path={router.path} />
      )}
    </section>
  );
};

const Navigation = () => {
  const { current, examples } = Examples.get();

  return (
    <nav className={styles.nav}>
      <a className={styles.logo} href="/">
        <Logo />
      </a>
      <div className={styles.links}>
        {examples.map((e) => (
          <Link
            key={e.path}
            to={e.path}
            aria-current={e === current ? 'page' : undefined}>
            {e.title}
          </Link>
        ))}
      </div>
    </nav>
  );
};

function titleCase(str: string) {
  return str
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export default Examples;
