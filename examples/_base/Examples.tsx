import { Component } from '@expressive/react';
import { Link, NavLinks, Route, Router } from '@expressive/router';
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

  render() {
    const {
      examples,
      examples: [first]
    } = this;

    return (
      <Route>
        {first && <Route to="" redirect={first.path} />}
        <main className={styles.shell}>
          <nav className={styles.nav}>
            <a className={styles.logo} href="/">
              <Logo />
            </a>
            <ExampleLinks />
          </nav>
          <section className={styles.example}>
            {examples.map((e) => (
              <ExampleRoute key={e.path} to={e.path} title={e.title} file={e.file} />
            ))}
            <NotFoundRoute />
          </section>
        </main>
      </Route>
    );
  }
}

class NotFoundRoute extends Route {
  fallback = true;

  render() {
    return <NotFound path={this.router.path} />;
  }
}

class ExampleRoute extends Route {
  title = '';
  file = '';

  render() {
    return (
      <iframe
        className={styles.frame}
        title={this.title}
        src={`module#${encodeURIComponent(this.file)}`}
      />
    );
  }
}

class ExampleLinks extends NavLinks {
  List(props: { children?: React.ReactNode }) {
    return <div className={styles.links}>{props.children}</div>;
  }

  Item({ route, active }: { route: Route; active: boolean }) {
    const { path, title } = route as ExampleRoute;
    return (
      <Link to={path} aria-current={active ? 'page' : undefined}>
        {title}
      </Link>
    );
  }
}

function titleCase(str: string) {
  return str
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export default Examples;
