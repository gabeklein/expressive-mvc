import { Consumer, Context } from '@expressive/react';

import { act, beforeEach, describe, expect, it, render } from '../vitest';

import { Route } from './route';
import { Router } from './router';

beforeEach(() => {
  Context.root.get(Router, false)?.set(null);
  window.history.replaceState(null, '', '/');
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const RootLayout = (props: { children?: React.ReactNode }) => (
  <div data-root>{props.children}</div>
);
const HomePage = () => <h1>home</h1>;
const BlogLayout = (props: { children?: React.ReactNode }) => (
  <section data-blog>{props.children}</section>
);
const BlogIndex = () => <p>blog-index</p>;
const BlogPost = () => (
  <Consumer for={Route}>
    {(r) => <article>post:{r.match!.slug}</article>}
  </Consumer>
);
const NotFound = () => <p>not-found</p>;

function Tree() {
  return (
    <Route as={RootLayout}>
      <Route to="" as={HomePage} />
      <Route to="blog/*" as={BlogLayout}>
        <Route to="" as={BlogIndex} />
        <Route to=":slug" as={BlogPost} />
      </Route>
      <Route as={NotFound} />
    </Route>
  );
}

describe('acceptance: nested file-routing tree', () => {
  it('/ -> RootLayout > HomePage', async () => {
    window.history.replaceState(null, '', '/');
    const view = render(<Tree />);
    expect(view.container.querySelector('[data-root]')).not.toBeNull();
    await settle();
    expect(view.container.textContent).toBe('home');
  });

  it('/blog -> RootLayout > BlogLayout > BlogIndex', async () => {
    window.history.replaceState(null, '', '/blog');
    const view = render(<Tree />);
    expect(view.container.querySelector('[data-root]')).not.toBeNull();
    await settle();
    expect(view.container.querySelector('[data-blog]')).not.toBeNull();
    await settle();
    expect(view.container.textContent).toBe('blog-index');
  });

  it('/blog/hello-world -> RootLayout > BlogLayout > BlogPost(slug)', async () => {
    window.history.replaceState(null, '', '/blog/hello-world');
    const view = render(<Tree />);
    await settle();
    expect(view.container.querySelector('[data-blog]')).not.toBeNull();
    await settle();
    expect(view.container.textContent).toBe('post:hello-world');
  });

  it('/anything-else -> RootLayout > NotFound', async () => {
    window.history.replaceState(null, '', '/anything-else');
    const view = render(<Tree />);
    expect(view.container.querySelector('[data-root]')).not.toBeNull();
    await settle();
    expect(view.container.querySelector('[data-blog]')).toBeNull();
    await settle();
    expect(view.container.textContent).toBe('not-found');
  });

  it('navigating /blog/a -> /blog/b preserves the BlogPost instance', async () => {
    window.history.replaceState(null, '', '/blog/a');
    let mountCount = 0;
    const Tracked = () => {
      mountCount++;
      return (
        <Consumer for={Route}>{(r) => <span>{r.match!.slug}</span>}</Consumer>
      );
    };
    const router = Router.new();
    const view = render(
      <Route to="/blog/*" as={BlogLayout}>
        <Route to=":slug" as={Tracked} />
      </Route>
    );
    await settle();
    expect(mountCount).toBe(1);
    await settle();
    expect(view.container.textContent).toBe('a');

    await act(async () => router.goto('/blog/b'));

    expect(mountCount).toBe(1);
    await settle();
    expect(view.container.textContent).toBe('b');
  });
});
