import '@expressive/react';
import { BrowserRouter, NavLinks, Route, Router } from '@expressive/router';

import Logo from './Logo';
import Theme, { Toggle } from './Theme';
import styles from './Shell.module.css';
import { Provider } from '@expressive/react';
import { frameSrc, leaves, type Directory } from '../pages';

const Shell = ({ tree }: { tree: Directory[] }) => {
  const [first] = leaves(tree);

  if (!first) throw new Error("No examples are loaded.");

  return (
    <Provider for={{ Theme, BrowserRouter }}>
      <Route as={Window}>
        <Route redirect={`/${first.path}`} />
        {tree.map(renderDirectory)}
        <Route default as={NotFound} />
      </Route>
    </Provider>
  );
};

export default Shell;

const renderDirectory = (d: Directory): React.ReactNode =>
  d.children
    ? <Route key={d.slug} to={d.slug} label={d.label}>{d.children.map(renderDirectory)}</Route>
    : <Route key={d.slug} to={d.slug} as={Outlet} label={d.label} meta={d} />;

function Window(props: { children?: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.logo} href="/">
          <Logo />
        </a>
        <Toggle />
        <div className={styles.headerRule} />
      </header>
      <nav className={styles.nav}>
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
        <div className={styles.groupItems}>{props.children}</div>
      </div>
    );
  }
}

function Outlet() {
  const { label, meta } = Route.get();
  const { paint } = Theme.get();

  if (meta)
    return (
      <iframe
        title={label}
        className={styles.frame}
        src={frameSrc(meta.file)}
        ref={paint}
        onLoad={(e) => paint(e.currentTarget)}
      />
    );
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
