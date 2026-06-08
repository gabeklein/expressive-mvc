import { Component } from '@expressive/react';
import { NavLinks, Route } from '@expressive/router';
import { type ComponentType } from 'react';
import Logo from './Logo';
import styles from './Examples.module.css';
import { Router } from '@expressive/router';

export type AppModule = { default: ComponentType };

interface Example {
  order: number;
  slug: string;
  label: string;
  path: string;
  file: string;
}

interface Group {
  order: number;
  slug: string;
  label: string;
  items: Example[];
}

const order = (seg: string) => +(seg.match(/^(\d+)-/)?.[1] ?? 0);
const slug = (seg: string) => seg.replace(/^\d+-/, '');

function byOrder<T extends Group | Example>(arr: T[]) {
  return arr.sort((a, b) => a.order - b.order);
}

class Examples extends Component {
  modules: Record<string, () => Promise<AppModule>> = {};

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
            slug: slug(g),
            label: titleCase(slug(g)),
            items: []
          })
        );

      group.items.push({
        order: order(l),
        slug: slug(l) + '/*',
        label: titleCase(slug(l)),
        path: `/${slug(g)}/${slug(l)}`,
        file
      });
    }

    return byOrder([...groups.values()]).map((g) => ({
      ...g,
      items: byOrder(g.items)
    }));
  }

  render() {
    const { groups } = this;
    const first = groups[0]?.items[0];

    return (
      <Route as={Shell}>
        {first && <Route to="" redirect={first.path} />}
        {groups.map((g) => (
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
      <p>No example matches <code>{path}</code>.</p>
    </div>
  );
}

function titleCase(str: string) {
  return str
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export default Examples;
