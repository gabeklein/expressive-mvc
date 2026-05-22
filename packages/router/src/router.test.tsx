import { act, beforeEach, describe, expect, it, render, vi } from '../vitest';

import { matchPattern, Router } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

function capture() {
  let router!: Router;
  const view = render(<Router is={(r) => (router = r)} />);
  return { router: router!, view };
}

describe('Router', () => {
  it('initializes from window.location', () => {
    window.history.replaceState(null, '', '/foo');
    const { router } = capture();
    expect(router.path).toBe('/foo');
  });

  it('goto pushes history and updates path', () => {
    const { router } = capture();
    act(() => router.goto('/bar'));
    expect(router.path).toBe('/bar');
    expect(window.location.pathname).toBe('/bar');
  });

  it('goto with replace uses replaceState', () => {
    const { router } = capture();
    const before = window.history.length;
    act(() => router.goto('/replaced', true));
    expect(router.path).toBe('/replaced');
    expect(window.location.pathname).toBe('/replaced');
    expect(window.history.length).toBe(before);
  });

  it('updates path on popstate', () => {
    const { router } = capture();
    act(() => {
      window.history.pushState(null, '', '/elsewhere');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(router.path).toBe('/elsewhere');
  });

  it('removes popstate listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { view } = capture();
    view.unmount();
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
    remove.mockRestore();
  });
});


describe('matchPattern', () => {
  it('matches root', () => {
    expect(matchPattern('/', '/')).toEqual({ params: {} });
  });

  it('matches literal segments', () => {
    expect(matchPattern('/foo/bar', '/foo/bar')).toEqual({ params: {} });
  });

  it('returns null for non-matching literals', () => {
    expect(matchPattern('/foo/bar', '/foo/baz')).toBeNull();
  });

  it('returns null when segment counts differ', () => {
    expect(matchPattern('/foo', '/foo/bar')).toBeNull();
    expect(matchPattern('/foo/bar', '/foo')).toBeNull();
  });

  it('captures :param', () => {
    expect(matchPattern('/posts/:id', '/posts/foo')).toEqual({
      params: { id: 'foo' }
    });
  });

  it('captures multiple :params', () => {
    expect(
      matchPattern('/users/:userId/posts/:postId', '/users/u1/posts/p1')
    ).toEqual({ params: { userId: 'u1', postId: 'p1' } });
  });

  it('normalizes trailing slashes', () => {
    expect(matchPattern('/foo', '/foo/')).toEqual({ params: {} });
    expect(matchPattern('/foo/', '/foo')).toEqual({ params: {} });
    expect(matchPattern('/posts/:id/', '/posts/foo')).toEqual({
      params: { id: 'foo' }
    });
  });

  it('matches case-insensitively on literal segments', () => {
    expect(matchPattern('/Foo/Bar', '/foo/bar')).toEqual({ params: {} });
  });

  it('preserves case in captured params', () => {
    expect(matchPattern('/posts/:id', '/posts/FOO')).toEqual({
      params: { id: 'FOO' }
    });
  });

  it('handles empty path against root pattern', () => {
    expect(matchPattern('/', '')).toEqual({ params: {} });
  });

  it('returns null for no-match with params', () => {
    expect(matchPattern('/posts/:id/edit', '/posts/foo')).toBeNull();
  });
});
