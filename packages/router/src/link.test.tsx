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

  it('will navigate on plain left-click', async () => {
    expect(await click(link())).toBe(false);
    expect(router.current.path).toBe('/about');
  });

  it('will navigate with target=_self', async () => {
    expect(await click(link({ target: '_self' }))).toBe(false);
    expect(router.current.path).toBe('/about');
  });

  it('will navigate with target=_SELF', async () => {
    expect(await click(link({ target: '_SELF' }))).toBe(false);
    expect(router.current.path).toBe('/about');
  });

  it('will navigate with download={false}', async () => {
    expect(await click(link({ download: false }))).toBe(false);
    expect(router.current.path).toBe('/about');
  });

  it('will ignore modifier-clicks (meta/ctrl/shift/alt)', async () => {
    const a = link();
    for (const mod of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      await click(a, { [mod]: true });
      expect(router.current.path).toBe('/');
    }
  });

  it('will ignore middle-click', async () => {
    await click(link(), { button: 1 });
    expect(router.current.path).toBe('/');
  });

  it('will not navigate if consumer onClick prevents default', async () => {
    await click(link({ onClick: (e: any) => e.preventDefault() }));
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

  it('will resolve relative `to` against nearest Route', async () => {
    location('/posts/foo');
    const a = link({ to: './edit' }, '/posts/:id');
    expect(a.getAttribute('href')).toBe('/posts/foo/edit');

    await click(a);
    expect(router.current.url).toBe('/posts/foo/edit');
  });

  it('will preserve query and fragment in a relative `to`', async () => {
    location('/posts/foo');
    const a = link({ to: './edit?tab=history#form' }, '/posts/:id');
    expect(a.getAttribute('href')).toBe('/posts/foo/edit?tab=history#form');

    await click(a);
    expect(router.current.url).toBe('/posts/foo/edit?tab=history#form');
  });

  it('will resolve a fragment against the Route, keeping query', async () => {
    location('/posts/foo?view=full#intro');
    const a = link({ to: '#details' }, '/posts/:id');
    expect(a.getAttribute('href')).toBe('/posts/foo?view=full#details');

    await click(a);
    expect(router.current.url).toBe('/posts/foo?view=full#details');
  });

  it('will resolve a fragment against the root Route', async () => {
    location('/?view=full');
    const a = link({ to: '#details' }, '/');
    expect(a.getAttribute('href')).toBe('/?view=full#details');

    await click(a);
    expect(router.current.url).toBe('/?view=full#details');
  });

  it('will leave scheme-bearing hrefs to the browser', () => {
    const onClick = vi.fn();
    const link = grab({ to: 'https://example.com/docs?q=1#intro', onClick });

    expect(link.href).toBe('https://example.com/docs?q=1#intro');
    expect(leftClick(link)).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(router.current.path).toBe('/');
  });

  it('will leave protocol-relative hrefs to the browser', () => {
    const onClick = vi.fn();
    const link = grab({ to: '//cdn.example.com/file.js', onClick });

    expect(link.href).toBe('//cdn.example.com/file.js');
    expect(leftClick(link)).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(router.current.path).toBe('/');
  });

  it('will leave target=_blank clicks to the browser', () => {
    const onClick = vi.fn();
    const link = grab({ to: '/about', target: '_blank', onClick });

    expect(link.href).toBe('/about');
    expect(leftClick(link)).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(router.current.path).toBe('/');
  });

  it('will leave named target clicks to the browser', () => {
    const onClick = vi.fn();
    const link = grab({ to: '/about', target: 'preview', onClick });

    expect(link.href).toBe('/about');
    expect(leftClick(link)).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(router.current.path).toBe('/');
  });

  it('will leave download clicks to the browser', () => {
    const onClick = vi.fn();
    const link = grab({ to: '/report', download: true, onClick });

    expect(link.href).toBe('/report');
    expect(leftClick(link)).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(router.current.path).toBe('/');
  });

  it('will leave empty download clicks to the browser', () => {
    const onClick = vi.fn();
    const link = grab({ to: '/report', download: '', onClick });

    expect(link.href).toBe('/report');
    expect(leftClick(link)).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(router.current.path).toBe('/');
  });

  it('will leave named download clicks to the browser', () => {
    const onClick = vi.fn();
    const link = grab({ to: '/report', download: 'report.pdf', onClick });

    expect(link.href).toBe('/report');
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

  it('will match exactly on the same path', () => {
    location('/about');
    const a = nav('/about');
    expect(a.getAttribute('data-match')).toBe('true');
    expect(a.getAttribute('class')).toBe('active');
  });

  it('will match by prefix on a child path', () => {
    location('/blog/post-1');
    const a = nav('/blog');
    expect(a.getAttribute('data-match')).toBe('false');
    expect(a.getAttribute('class')).toBe('active');
  });

  it('will not match a sibling sharing a string prefix', () => {
    location('/blogging');
    const a = nav('/blog');
    expect(a.getAttribute('data-match')).toBe('undefined');
    expect(a.getAttribute('class')).toBe(null);
  });

  it('will match a root link by prefix everywhere', () => {
    location('/about');
    const a = nav('/');
    expect(a.getAttribute('data-match')).toBe('false');
    expect(a.getAttribute('class')).toBe('active');
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
