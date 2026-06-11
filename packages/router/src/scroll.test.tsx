import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { browserRouter } from '../test.setup';
import { ScrollRestoration } from './scroll';

const STORAGE = 'expressive-router:scroll';
const router = browserRouter();

beforeEach(() => {
  sessionStorage.clear();
  window.scrollTo(0, 0);
});

describe('ScrollRestoration', () => {
  it('scrolls to top on push navigation', async () => {
    const scrollTo = spyOn(window, 'scrollTo');
    render(<ScrollRestoration />);

    await act(async () => router.current.goto('/about'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('restores saved position on back navigation', async () => {
    render(<ScrollRestoration />);
    window.scrollTo(0, 150);

    await act(async () => router.current.goto('/about'));
    expect(window.scrollY).toBe(0);

    await act(async () => router.current.back());
    expect(router.current.path).toBe('/');
    expect(window.scrollY).toBe(150);
  });

  it('scrolls to top on back when no position was saved', async () => {
    sessionStorage.setItem(STORAGE, JSON.stringify({}));
    render(<ScrollRestoration />);

    await act(async () => router.current.goto('/about'));
    window.scrollTo(0, 80);

    await act(async () => router.current.back());
    expect(window.scrollY).toBe(0);
  });

  it('persists positions across instances via sessionStorage', async () => {
    const view = render(<ScrollRestoration />);
    window.scrollTo(0, 220);

    await act(async () => router.current.goto('/about'));
    view.unmount();

    expect(JSON.parse(sessionStorage.getItem(STORAGE)!)).toEqual({ '/': 220 });
  });

  it('tolerates corrupt storage', async () => {
    sessionStorage.setItem(STORAGE, 'not json');
    const scrollTo = spyOn(window, 'scrollTo');
    render(<ScrollRestoration />);

    await act(async () => router.current.goto('/about'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('stops listening after unmount', async () => {
    const view = render(<ScrollRestoration />);
    window.scrollTo(0, 90);

    await act(async () => router.current.goto('/about'));
    view.unmount();
    window.scrollTo(0, 30);

    await act(async () => router.current.back());
    expect(window.scrollY).toBe(30);
  });
});
