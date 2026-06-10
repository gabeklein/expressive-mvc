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
  load: () => Promise<AppModule>;
}

export interface Group {
  order: number;
  slug: string;
  label: string;
  items: Example[];
}

function Examples({ routes }: { routes: Group[] }) {
  const first = routes[0]?.items[0];

  return (
    <Route as={Shell}>
      {first && <Route redirect={first.path} />}
      {routes.map((g) => (
        <Route key={g.slug} to={g.slug} label={g.label}>
          {g.items.map((e) => (
            <Route
              key={e.slug}
              to={e.slug}
              label={e.label}
              as={ExampleFrame}
              meta={e}
            />
          ))}
        </Route>
      ))}
      <Route default as={NotFound} />
    </Route>
  );
}

const LOADED = new Set<string>();
const PENDING = new Map<string, Promise<unknown>>();

/** Suspend until the example's module is loaded (cached). This covers the bulk
 * of the navigation wait without mounting the iframe yet; the router's scope
 * boundary holds the current example meanwhile (deferred presentation). */
function awaitModule(file: string, load: () => Promise<unknown>) {
  if (LOADED.has(file)) return;

  let pending = PENDING.get(file);
  if (!pending) {
    pending = load().then(() => {
      LOADED.add(file);
      PENDING.delete(file);
    });
    PENDING.set(file, pending);
  }

  throw pending;
}

function ExampleFrame() {
  const { label, meta } = Route.get();

  awaitModule(meta!.file, meta!.load);

  return (
    <iframe
      className={styles.frame}
      title={label}
      src={`module#${encodeURIComponent(meta!.file)}`}
    />
  );
}

function Shell(props: { children?: React.ReactNode }) {
  const { pending } = Router.get();

  return (
    <main className={styles.shell}>
      <nav className={styles.nav}>
        <a className={styles.logo} href="/">
          <Logo />
        </a>
        <Navigation />
      </nav>
      <section className={styles.example} aria-busy={pending}>
        {props.children}
        {pending && <div className={styles.overlay} />}
      </section>
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
