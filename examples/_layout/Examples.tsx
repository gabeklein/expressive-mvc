import '@expressive/react';
import { BrowserRouter, NavLinks, Route, Router } from '@expressive/router';
import { type ComponentType } from 'react';

import Logo from './Logo';
import { organize } from './loader';
import styles from './Examples.module.css';

type LazyModule = () => Promise<{ default: ComponentType }>;

function Examples({ modules }: { modules: Record<string, LazyModule> }) {
  const routes = organize(modules);
  const first = routes[0]?.items[0];

  return (
    <BrowserRouter>
      <Route as={Shell}>
        {first && <Route redirect={first.path} />}
        {routes.map((g) => (
          <Route key={g.slug} to={g.slug} label={g.label}>
            {g.items.map((e) => (
              <Route
                key={e.slug}
                to={e.slug}
                label={e.label}
                as={Example}
                meta={e}
              />
            ))}
          </Route>
        ))}
        <Route default as={NotFound} />
      </Route>
    </BrowserRouter>
  );
}

function Example() {
  const { label, meta } = Route.get();

  return (
    <iframe
      className={styles.frame}
      title={label}
      src={`module#${encodeURIComponent(meta!.file)}`}
    />
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
