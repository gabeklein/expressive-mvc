import { Consumer } from '@expressive/react';

import { act, beforeEach, describe, expect, it, render } from '../vitest';

import { Route } from './route';
import { Router } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

const Home = () => <h1>Home</h1>;
const Post = () => {
  return (
    <Consumer for={Route}>
      {(r) => <article>id: {r.params.id}</article>}
    </Consumer>
  );
};

describe('Route', () => {
  it('mounts the page when its pattern matches', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Router>
        <Route to="/" as={Home} />
        <Route to="/posts/:id" as={Post} />
      </Router>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('does not mount any page when nothing matches', () => {
    window.history.replaceState(null, '', '/unknown');
    const view = render(
      <Router>
        <Route to="/" as={Home} />
      </Router>
    );
    expect(view.container.textContent).toBe('');
  });

  it('exposes params from the matched pattern', () => {
    window.history.replaceState(null, '', '/posts/foo');
    const view = render(
      <Router>
        <Route to="/posts/:id" as={Post} />
      </Router>
    );
    expect(view.container.textContent).toBe('id: foo');
  });

  it('updates in place on same-pattern navigation (instance persists)', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let mountCount = 0;
    let router!: Router;

    const Page = () => {
      mountCount++;
      return (
        <Consumer for={Route}>{(r) => <span>{r.params.id}</span>}</Consumer>
      );
    };

    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/posts/:id" as={Page} />
      </Router>
    );

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('foo');

    await act(async () => router.goto('/posts/bar'));

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('bar');
  });

  it('ignores non-Route children when resolving', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Router>
        <div>chrome</div>
        {'text node'}
        <Route to="/" as={Home} />
      </Router>
    );
    // Only the matched Route's page renders; non-Route children are dropped.
    expect(view.container.textContent).toBe('Home');
  });

  it('defaults `as` to a children-passthrough', () => {
    window.history.replaceState(null, '', '/anything');
    const view = render(
      <Router>
        <Route to="/anything">
          <span>inline</span>
        </Route>
      </Router>
    );
    expect(view.container.textContent).toBe('inline');
  });

  it('matches when `to` is omitted (treated as empty pattern)', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Router>
        <Route as={Home} />
      </Router>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('params returns empty when match invalidated by navigation', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    let router!: Router;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <Router is={(r) => (router = r)}>
        <Route to="/posts/:id" as={Page} />
      </Router>
    );
    expect(leaf.params).toEqual({ id: 'foo' });

    // Navigate to a path the Route does not match. The Route instance
    // briefly evaluates with a null match before unmounting.
    await act(async () => router.goto('/elsewhere'));
    expect(leaf.params).toEqual({});
  });

  it('anchor handles patterns that already end with /', async () => {
    window.history.replaceState(null, '', '/');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <Router>
        <Route to="/" as={Page} />
      </Router>
    );
    expect(leaf.anchor).toBe('/');
  });

  it('Route.goto resolves relative paths via anchor', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <Router>
        <Route to="/posts/:id" as={Page} />
      </Router>
    );
    await act(async () => leaf.goto('./edit'));
    expect(window.location.pathname).toBe('/posts/foo/edit');
  });

  it('Route.goto treats empty string and "." as no-op', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <Router>
        <Route to="/posts/:id" as={Page} />
      </Router>
    );
    await act(async () => leaf.goto(''));
    await act(async () => leaf.goto('.'));
    expect(window.location.pathname).toBe('/posts/foo');
  });

  it('Route.goto passes through absolute paths to Router', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <Router>
        <Route to="/posts/:id" as={Page} />
        <Route to="/about" as={() => <div>about</div>} />
      </Router>
    );
    await act(async () => leaf.goto('/about'));
    expect(window.location.pathname).toBe('/about');
  });

  it('Router.goto throws on relative paths', () => {
    let router!: Router;
    render(<Router is={(r) => (router = r)} />);
    expect(() => router.goto('./x')).toThrow(/absolute path/);
  });

  it('default `as` renders nothing when given no children', () => {
    window.history.replaceState(null, '', '/blank');
    const view = render(
      <Router>
        <Route to="/blank" />
      </Router>
    );
    expect(view.container.textContent).toBe('');
  });
});
