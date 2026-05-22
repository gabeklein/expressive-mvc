import { act, beforeEach, describe, expect, it, render, vi } from '../vitest';

import { Router } from './router';

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
