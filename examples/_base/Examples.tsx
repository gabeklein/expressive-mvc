import { NavLinks, Route } from '@expressive/router';
import { type ComponentType } from 'react';
import Logo from './Logo';
import styles from './Examples.module.css';
import { Router } from '@expressive/router';

export type AppModule = { default: ComponentType };

export interface Example {
  order: number;
  slug: string;
  label: string;
  path: string;
  file: string;
}

export interface Group {
  order: number;
  slug: string;
  label: string;
  items: Example[];
}

function Examples(props: { routes: Group[] }) {
  const { routes } = props;
  const first = routes[0]?.items[0];

  return (
    <Route as={Shell}>
      {first && <Route to="" redirect={first.path} />}
      {routes.map((g) => (
        <Route key={g.slug} to={g.slug} label={g.label}>
          {g.items.map((e) => (
            <ExampleRoute
              key={e.slug}
              to={e.slug}
              label={e.label}
              file={e.file}
            />
          ))}
        </Route>
      ))}
      <Route fallback as={NotFound} />
    </Route>
  );
}

function Shell(props: { children?: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      <nav className={styles.nav}>
        <a className={styles.logo} href="/">
          <Logo />
        </a>
        <Navigation />
      </nav>
      <section className={styles.example}>{props.children}</section>
    </main>
  );
}

class ExampleRoute extends Route {
  file = '';

  render() {
    return (
      <iframe
        className={styles.frame}
        title={this.label}
        src={`module#${encodeURIComponent(this.file)}`}
      />
    );
  }
}

class Navigation extends NavLinks {
  List(props: { children?: React.ReactNode }) {
    return <div className={styles.links}>{props.children}</div>;
  }

  Group(props: { route: Route; children?: React.ReactNode }) {
    return (
      <div className={styles.group}>
        <h4 className={styles.groupLabel}>{props.route.label}</h4>
        {props.children}
      </div>
    );
  }
}

function NotFound() {
  const { path } = Router.get();

  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <h1>404</h1>
      <p>
        No example matches <code>{path}</code>.
      </p>
    </div>
  );
}

export default Examples;
