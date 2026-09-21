import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Consumer } from '@expressive/react';

import { location, browserRouter } from '../test.setup';
import { Route } from './route';
import { Router as CoreRouter } from './router';

class Router extends CoreRouter {
  static readonly global: (typeof CoreRouter)['global'] = false;
}

const router = browserRouter();

const RootLayout = (props: { children?: React.ReactNode }) => (
  <div data-root>{props.children}</div>
);
const HomePage = () => <h1>home</h1>;
const BlogLayout = (props: { children?: React.ReactNode }) => (
  <section data-blog>{props.children}</section>
);
const BlogIndex = () => <p>blog-index</p>;
const BlogPost = () => (
  <Consumer for={Route}>{(r) => <article>post:{r.match!.slug}</article>}</Consumer>
);
const NotFound = () => <p>not-found</p>;

function Tree() {
  return (
    <Route as={RootLayout}>
      <Route as={HomePage} />
      <Route to="blog" as={BlogLayout}>
        <Route as={BlogIndex} />
        <Route to=":slug" as={BlogPost} />
      </Route>
      <Route default as={NotFound} />
    </Route>
  );
}

describe('acceptance: nested file-routing tree', () => {
  it('/ -> RootLayout > HomePage', () => {
    location('/');
    const view = render(<Tree />);
    expect(view.container.querySelector('[data-root]')?.textContent).toBe('home');
  });

  it('/blog -> RootLayout > BlogLayout > BlogIndex', () => {
    location('/blog');
    const view = render(<Tree />);
    const blog = view.container.querySelector('[data-root] [data-blog]');
    expect(blog?.textContent).toBe('blog-index');
  });

  it('/blog/hello-world -> RootLayout > BlogLayout > BlogPost(slug)', () => {
    location('/blog/hello-world');
    const view = render(<Tree />);
    const blog = view.container.querySelector('[data-root] [data-blog]');
    expect(blog?.textContent).toBe('post:hello-world');
  });

  it('/anything-else -> RootLayout > NotFound', () => {
    location('/anything-else');
    const view = render(<Tree />);
    expect(view.container.querySelector('[data-blog]')).toBeNull();
    expect(view.container.querySelector('[data-root]')?.textContent).toBe('not-found');
  });

  it('navigating /blog/a -> /blog/b preserves the BlogPost instance', async () => {
    location('/blog/a');
    let mountCount = 0;
    const Tracked = () => {
      mountCount++;
      return (
        <Consumer for={Route}>{(r) => <span>{r.match!.slug}</span>}</Consumer>
      );
    };
    const view = render(
      <Route to="/blog/*" as={BlogLayout}>
        <Route to=":slug" as={Tracked} />
      </Route>
    );
    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('a');

    await act(async () => router.current.goto('/blog/b'));

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('b');
  });
});

describe('acceptance: nested Router', () => {
  const Page = () => (
    <Consumer for={CoreRouter}>
      {(router) => <span>{router.path}</span>}
    </Consumer>
  );

  class Flow extends Router {
    static readonly global = false;

    render() {
      return (
        <Route>
          <Route to="one" as={Page} />
          <Route to="two" as={Page} />
        </Route>
      );
    }
  }

  it('will mount a self-contained Router within an outer Route', () => {
    let outer!: Router;
    let boundary!: Route;
    let flow!: Flow;
    const view = render(
      <Router path="/flow" is={(router) => { outer = router; }}>
        <Route>
          <Route to="flow" is={(route) => { boundary = route; }}>
            <Flow path="/one" is={(router) => { flow = router; }} />
          </Route>
        </Route>
      </Router>
    );

    expect(outer.path).toBe('/flow');
    expect(boundary.path).toBe('/flow');
    expect(boundary.matched).toBe(true);
    expect(flow.path).toBe('/one');
    expect(view.container.textContent).toBe('/one');
  });

  it('will isolate inner location and history from the outer Router', async () => {
    let outer!: Router;
    let inner!: Router;
    const view = render(
      <Router path="/shell" is={(router) => { outer = router; }}>
        <Route as={RootLayout}>
          <Flow path="/one" is={(router) => { inner = router; }} />
        </Route>
      </Router>
    );

    expect(view.container.textContent).toBe('/one');

    await act(async () => inner.goto('/two'));
    expect(view.container.textContent).toBe('/two');
    expect(outer.path).toBe('/shell');

    await act(async () => outer.goto('/elsewhere'));
    expect(view.container.textContent).toBe('/two');
    expect(inner.path).toBe('/two');

    await act(async () => inner.back());
    expect(view.container.textContent).toBe('/one');
    expect(outer.path).toBe('/elsewhere');
  });

  it('will not bubble an out-of-bounds back to the outer Router', async () => {
    let outer!: Router;
    let inner!: Router;
    render(
      <Router path="/first" is={(router) => { outer = router; }}>
        <Route as={RootLayout}>
          <Flow path="/one" is={(router) => { inner = router; }} />
        </Route>
      </Router>
    );

    await act(async () => outer.goto('/second'));
    inner.back();

    expect(inner.path).toBe('/one');
    expect(outer.path).toBe('/second');
  });

  it('will reset an inline inner Router when its placement remounts', async () => {
    let inner!: Router;
    const App = ({ show }: { show: boolean }) => show
      ? <Flow path="/one" is={(router) => { inner = router; }} />
      : null;
    const view = render(<App show />);

    await act(async () => inner.goto('/two'));
    expect(view.container.textContent).toBe('/two');

    view.rerender(<App show={false} />);
    view.rerender(<App show />);

    expect(view.container.textContent).toBe('/one');
  });

  it('will preserve an externally owned Router across placement', async () => {
    const router = Flow.new({ path: '/one' });
    const App = ({ show }: { show: boolean }) => show ? router : null;
    const view = render(<App show />);

    await act(async () => router.goto('/two'));
    expect(view.container.textContent).toBe('/two');

    view.rerender(<App show={false} />);
    view.rerender(<App show />);

    expect(view.container.textContent).toBe('/two');
    router.set(null);
  });
});
