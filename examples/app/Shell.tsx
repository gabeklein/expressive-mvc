import '@expressive/react';
import { BrowserRouter, NavLinks, Route, Router } from '@expressive/router';

import Logo from './Logo';
import Toggle, { Theme } from './Theme';
import Routes, { Modules } from './Routes';
import styles from './Shell.module.css';
import { Provider } from '@expressive/react';

const Shell = (props: { modules: Modules }) => (
  <Provider for={{ Theme, BrowserRouter }}>
    <Routes
      as={Window}
      outlet={Outlet}
      notFound={NotFound}
      modules={props.modules}
    />
  </Provider>
);

export default Shell;

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

  if (meta)
    return (
      <iframe
        title={label}
        className={styles.frame}
        src={`module#${encodeURIComponent(meta.file)}`}
      />
    );
}

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
