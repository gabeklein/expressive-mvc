import { Component, get, Provider, ref } from '@expressive/react';
import { BrowserRouter, NavLinks, Route, Router } from '@expressive/router';

import Logo from './Logo';
import Theme, { Toggle } from './Theme';
import Code from './Code';
import { Spinner } from './Spinner';
import styles from './Shell.module.css';

import { frameSrc, type Directory } from '../pages';

const Shell = ({ tree, default: home }: { tree: Directory[]; default?: string }) => {
  return (
    <Provider for={{ Theme, BrowserRouter }}>
      <Route as={Window}>
        {home && <Route redirect={`/${home}`} />}
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

  if (meta)
    return (
      <Code key={meta.path} path={meta.path}>
        <ExampleFrame key={meta.file} file={meta.file} label={label} />
      </Code>
    );
}

// The iframe reloads a fresh document on every example swap, and a fresh
// document flashes its default (white) background before its own CSS paints.
// A themed cover sits over the iframe until the example posts `example:ready`
// (see main.tsx), so that flash is never visible. onLoad is a safety net.
class ExampleFrame extends Component {
  file = '';
  label?: string = undefined;
  ready = false;

  theme = get(Theme);
  frame = ref<HTMLIFrameElement>();

  protected new() {
    const settle = () => (this.ready = true);

    const onReady = (event: MessageEvent) => {
      if (
        event.data === 'example:ready' &&
        event.source === this.frame.current?.contentWindow
      )
        settle();
    };

    window.addEventListener('message', onReady);

    // Safety net if the example never signals. Cleared on teardown, so a
    // navigation before it fires can't write to a destroyed state.
    const timer = setTimeout(settle, 2000);

    return () => {
      window.removeEventListener('message', onReady);
      clearTimeout(timer);
    };
  }

  render() {
    const { file, label, ready, frame, theme } = this;

    // Reading `theme.paint` subscribes render to the mode, so a toggle
    // re-themes the current frame. The ref is a stable instruction (not a
    // new closure per render), so it fires once on mount - no update loop.
    theme.paint(frame.current);

    return (
      <div className={styles.frameWrap}>
        <iframe
          title={label}
          className={styles.frame}
          src={frameSrc(file)}
          ref={frame}
          onLoad={(e) => theme.paint(e.currentTarget)}
        />
        {!ready && (
          <div className={styles.frameCover} aria-hidden="true">
            <span className={styles.frameSpinner}>
              <Spinner />
            </span>
          </div>
        )}
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
