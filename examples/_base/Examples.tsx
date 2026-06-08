import { Component } from '@expressive/react';
import { NavLinks, Route, Router } from '@expressive/router';
import { NotFound } from './NotFound';
import { type ComponentType } from 'react';
import Logo from './Logo';
import styles from './Examples.module.css';

export type AppModule = { default: ComponentType };

const order = (seg: string) => +(seg.match(/^(\d+)-/)?.[1] ?? 0);
const slug = (seg: string) => seg.replace(/^\d+-/, '');
const byOrder = (a: { order: number }, b: { order: number }) =>
  a.order - b.order;

type Example = {
  order: number;
  to: string;
  label: string;
  path: string;
  file: string;
};
type Group = { order: number; to: string; label: string; items: Example[] };

class Examples extends Component {
  modules: Record<string, () => Promise<AppModule>> = {};
  router = new Router();

  /** Group example modules by their first path segment (`group/example/App.tsx`). */
  get groups(): Group[] {
    const groups = new Map<string, Group>();

    for (const file of Object.keys(this.modules)) {
      const [g, l] = file.split('/').slice(1, -1);
      let group = groups.get(g);

      if (!group)
        groups.set(
          g,
          (group = {
            order: order(g),
            to: slug(g) + "/*",
            label: titleCase(slug(g)),
            items: []
          })
        );

      group.items.push({
        order: order(l),
        to: slug(l),
        label: titleCase(slug(l)),
        path: `/${slug(g)}/${slug(l)}`,
        file
      });
    }

    return [...groups.values()]
      .sort(byOrder)
      .map((g) => ({ ...g, items: g.items.sort(byOrder) }));
  }

  render() {
    const { groups } = this;
    const first = groups[0]?.items[0];

    return (
      <Route as={Shell}>
        {first && <Route to="" redirect={first.path} />}
        {groups.map((g) => (
          <Route key={g.to} to={g.to} label={g.label}>
            {g.items.map((e) => (
              <ExampleRoute key={e.to} {...e} />
            ))}
          </Route>
        ))}
        <Route fallback as={NotFound} />
      </Route>
    );
  }
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

function titleCase(str: string) {
  return str
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export default Examples;
