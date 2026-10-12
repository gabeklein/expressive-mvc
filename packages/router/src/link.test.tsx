import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { location, browserRouter } from '../test.setup';
import { Link } from './link';
import { Route } from './route';

const router = browserRouter();

type Props = {
  to?: string;
  replace?: boolean;
  target?: string;
  download?: string | boolean;
  className?: string;
  onClick?: (event: any) => void;
};

function leftClick(link: Link) {
  const preventDefault = vi.fn();
  const go = Reflect.get(link, 'go') as (event: {
    defaultPrevented: boolean;
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    preventDefault(): void;
  }) => void;
  go({
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault
  });
  return preventDefault;
}

const link = (props: Props = {}, route = '/') =>
  render(
    <Route to={route}>
      <Link to="/about" {...props}>about</Link>
    </Route>
  ).container.querySelector('a')!;

function grab(props: Props) {
  let link!: Link;
  const Grab = () => {
    link = Link.get();
    return <>about</>;
  };
  render(
    <Route to="/">
      <Link {...props}><Grab /></Link>
    </Route>
  );
  return link;
}

async function click(a: HTMLAnchorElement, init: object = {}) {
  let result!: boolean;
  await act(async () => {
    result = fireEvent.click(a, { button: 0, ...init });
  });
  return result;
}

describe('Link', () => {
  it('will render an anchor with the target href', () => {
    const a = link();
    expect(a.getAttribute('href')).toBe('/about');
    expect(a.textContent).toBe('about');
  });

  it('will pass through bare invocation as foreign content', () => {
    const link = grab({ to: '/about' });
    expect(Link.prototype.render.call(link)).toBeUndefined();
  });

  it.each([
    ['will navigate on plain left-click', {}],
    ['will navigate with target=_self', { target: '_self' }],
    ['will navigate with target=_SELF', { target: '_SELF' }],
    ['will navigate with download={false}', { download: false }]
  ])('%s', async (_, props) => {
    expect(await click(link(props))).toBe(false);
    expect(router.current.path).toBe('/about');
  });

  it.each([
    ['will ignore meta-click', {}, { metaKey: true }],
    ['will ignore ctrl-click', {}, { ctrlKey: true }],
    ['will ignore shift-click', {}, { shiftKey: true }],
    ['will ignore alt-click', {}, { altKey: true }],
    ['will ignore middle-click', {}, { button: 1 }],
    ['will not navigate if consumer onClick prevents default', { onClick: (e: any) => e.preventDefault() }, {}]
  ])('%s', async (_, props, init) => {
    await click(link(props), init);
    expect(router.current.path).toBe('/');
  });

  it('will respect defaultPrevented from an ancestor', async () => {
    const view = render(
      <Route to="/">
        <div onClickCapture={(e) => e.preventDefault()}>
          <Link to="/about">about</Link>
        </div>
      </Route>
    );
    await click(view.container.querySelector('a')!);
    expect(router.current.path).toBe('/');
  });

  it('will call consumer onClick before navigating', async () => {
    const onClick = vi.fn(() => expect(router.current.path).toBe('/'));
    await click(link({ onClick }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(router.current.path).toBe('/about');
  });

  it('will replace history when replace', async () => {
    const before = window.history.length;
    await click(link({ replace: true }));
    expect(router.current.path).toBe('/about');
    expect(window.history.length).toBe(before);
  });

  it('will forward extra anchor props but not to/replace', () => {
    const a = link({ replace: true, className: 'nav', 'aria-current': 'page', 'data-id': 'x' } as Props);
    expect(a.getAttribute('class')).toBe('nav');
    expect(a.getAttribute('aria-current')).toBe('page');
    expect(a.getAttribute('data-id')).toBe('x');
    expect(a.hasAttribute('to')).toBe(false);
    expect(a.hasAttribute('replace')).toBe(false);
  });

  it.each([
    ['will resolve relative `to` against nearest Route', '/posts/foo', '/posts/:id', './edit', '/posts/foo/edit'],
    ['will preserve query and fragment in a relative `to`', '/posts/foo', '/posts/:id', './edit?tab=history#form', '/posts/foo/edit?tab=history#form'],
    ['will resolve a fragment against the Route, keeping query', '/posts/foo?view=full#intro', '/posts/:id', '#details', '/posts/foo?view=full#details'],
    ['will resolve a fragment against the root Route', '/?view=full', '/', '#details', '/?view=full#details']
  ])('%s', async (_, at, route, to, href) => {
    location(at);
    const a = link({ to }, route);
    expect(a.getAttribute('href')).toBe(href);

    await click(a);
    expect(router.current.url).toBe(href);
  });

  it.each([
    ['will leave scheme-bearing hrefs to the browser', { to: 'https://example.com/docs?q=1#intro' }],
    ['will leave protocol-relative hrefs to the browser', { to: '//cdn.example.com/file.js' }],
    ['will leave target=_blank clicks to the browser', { to: '/about', target: '_blank' }],
    ['will leave named target clicks to the browser', { to: '/about', target: 'preview' }],
    ['will leave download clicks to the browser', { to: '/report', download: true }],
    ['will leave empty download clicks to the browser', { to: '/report', download: '' }],
    ['will leave named download clicks to the browser', { to: '/report', download: 'report.pdf' }]
  ])('%s', (_, props) => {
    const onClick = vi.fn();
    const link = grab({ ...props, onClick });

    expect(link.href).toBe(props.to);
    expect(leftClick(link)).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(router.current.path).toBe('/');
  });
});

describe('Link.match / Link.active', () => {
  let renders = 0;

  class NavLink extends Link {
    render() {
      renders++;
      return (
        <a
          href={this.href}
          onClick={this.go}
          className={this.active ? 'active' : undefined}
          data-match={String(this.match)}>
          {this.props.children}
        </a>
      );
    }
  }

  beforeEach(() => {
    renders = 0;
  });

  const nav = (to: string) =>
    render(
      <Route to="*">
        <NavLink to={to}>link</NavLink>
      </Route>
    ).container.querySelector('a')!;

  it.each([
    ['will match exactly on the same path', '/about', '/about', 'true', 'active'],
    ['will match by prefix on a child path', '/blog/post-1', '/blog', 'false', 'active'],
    ['will not match a sibling sharing a string prefix', '/blogging', '/blog', 'undefined', null],
    ['will match a root link by prefix everywhere', '/about', '/', 'false', 'active']
  ])('%s', (_, at, to, match, className) => {
    location(at);
    const a = nav(to);
    expect(a.getAttribute('data-match')).toBe(match);
    expect(a.getAttribute('class')).toBe(className);
  });

  it('will toggle across navigation and re-render only because render reads active', async () => {
    const a = nav('/about');
    expect(a.getAttribute('class')).toBe(null);
    expect(renders).toBe(1);

    await act(async () => router.current.goto('/about'));
    expect(a.getAttribute('class')).toBe('active');
    expect(renders).toBe(2);

    await act(async () => router.current.goto('/'));
    expect(a.getAttribute('class')).toBe(null);
  });

  it('will not re-render a Link that reads neither (lazy subscription)', async () => {
    class PlainLink extends Link {
      render(props = {} as Link.Props) {
        renders++;
        return super.render(props);
      }
    }

    render(
      <Route to="*">
        <PlainLink to="/about">about</PlainLink>
      </Route>
    );
    expect(renders).toBe(1);

    await act(async () => router.current.goto('/about'));
    expect(renders).toBe(1);
  });
});

it('will accept spread Link.Props', () => {
  location('/');
  const props: Link.Props = { to: '/about', children: 'About' };
  const { getByText } = render(
    <Route>
      <Link {...props} />
    </Route>
  );

  expect(getByText('About').getAttribute('href')).toBe('/about');
});
