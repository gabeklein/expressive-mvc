import { describe, expect, it } from 'vitest';

import { Router } from './router';

describe('Router (headless)', () => {
  it('defaults to root', () => {
    expect(Router.new().path).toBe('/');
  });

  it('goto updates path in memory', () => {
    const router = Router.new();
    router.goto('/bar');
    expect(router.path).toBe('/bar');
  });

  it('goto normalizes . and ..', () => {
    const router = Router.new();
    router.goto('/posts/foo/../bar');
    expect(router.path).toBe('/posts/bar');
  });

  it('goto throws on relative paths', () => {
    expect(() => Router.new().goto('./x')).toThrow(/absolute path/);
  });

  it('seeds the history stack from the initial path', () => {
    const router = Router.new({ path: '/start' });
    expect(router.entries).toEqual(['/start']);
    expect(router.index).toBe(0);
  });

  it('goto pushes onto the stack; back/forward move the cursor', () => {
    const router = Router.new();
    router.goto('/a');
    router.goto('/b');
    expect(router.entries).toEqual(['/', '/a', '/b']);

    router.back();
    expect(router.path).toBe('/a');
    router.back();
    expect(router.path).toBe('/');
    router.forward();
    expect(router.path).toBe('/a');
  });

  it('back does nothing at the oldest entry', () => {
    const router = Router.new();
    router.back();
    expect(router.path).toBe('/');
    expect(router.index).toBe(0);
  });

  it('forward does nothing at the newest entry', () => {
    const router = Router.new();
    router.goto('/a');
    router.forward();
    expect(router.path).toBe('/a');
    expect(router.index).toBe(1);
  });

  it('goto drops an empty query', () => {
    const router = Router.new();
    router.goto('/a?&');
    expect(router.path).toBe('/a');
    expect(router.entries).toEqual(['/', '/a']);
  });

  it('url omits query params set to undefined', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    router.query.set('page', undefined as any);
    expect(router.url).toBe('/posts');
  });

  it('goto with replace overwrites the current entry', () => {
    const router = Router.new();
    router.goto('/a');
    router.goto('/b', true);
    expect(router.entries).toEqual(['/', '/b']);
    expect(router.path).toBe('/b');
  });

  it('goto after back truncates the forward history', () => {
    const router = Router.new();
    router.goto('/a');
    router.goto('/b');
    router.back();
    router.goto('/c');
    expect(router.entries).toEqual(['/', '/a', '/c']);
    expect(router.path).toBe('/c');
  });

  it('goto splits query string from path', () => {
    const router = Router.new();
    router.goto('/posts?page=2&sort=asc');
    expect(router.path).toBe('/posts');
    expect(router.url).toBe('/posts?page=2&sort=asc');
  });

  it('goto without query clears the query', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    router.goto('/posts');
    expect(router.url).toBe('/posts');
  });

  it('canonicalizes the query so navigation does not push a duplicate entry', async () => {
    const encoded = Router.new();
    encoded.goto('/x?q=a%20b');
    await encoded.set();
    expect(encoded.entries).toEqual(['/', '/x?q=a+b']);
    encoded.set(null);

    const repeated = Router.new();
    repeated.goto('/x?a=1&a=2');
    await repeated.set();
    expect(repeated.entries).toEqual(['/', '/x?a=2']);
  });

  it('query exposes params as a map', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    expect(router.query.get('page')).toBe('2');
  });

  it('direct query mutation pushes a new entry', async () => {
    const router = Router.new();
    router.goto('/posts');
    await router.set();

    router.query.set('page', '2');
    await router.set();

    expect(router.entries).toEqual(['/', '/posts', '/posts?page=2']);
    expect(router.url).toBe('/posts?page=2');
  });

  it('stops tracking query once destroyed', async () => {
    const router = Router.new();
    router.goto('/posts');
    await router.set();

    router.set(null);

    expect(router.get(null)).toBe(true);
    expect(router.entries).toEqual(['/', '/posts']);
  });

  it('query updates reactively when search changes', async () => {
    const router = Router.new();
    const seen: (string | undefined)[] = [];

    router.get(state => {
      seen.push(state.query.get('page'));
    });

    router.goto('/posts?page=1');
    await router.set();
    router.goto('/posts?page=2');
    await router.set();

    expect(seen).toEqual([undefined, '1', '2']);
  });

  it('writing a query param pushes a new history entry', async () => {
    const router = Router.new();
    router.goto('/posts?page=1');
    router.query.set('page', '2');
    await router.set();

    expect(router.url).toBe('/posts?page=2');
    router.back();
    expect(router.url).toBe('/posts?page=1');
  });

  it('deleting a query param navigates', async () => {
    const router = Router.new();
    router.goto('/posts?page=2&sort=asc');
    router.query.delete('sort');
    await router.set();

    expect(router.query.get('sort')).toBeUndefined();
    expect(router.path).toBe('/posts');
  });

  it('assigning url navigates (push)', () => {
    const router = Router.new();
    router.goto('/a');
    router.url = '/b?x=1';

    expect(router.path).toBe('/b');
    expect(router.query.get('x')).toBe('1');
    expect(router.entries).toEqual(['/', '/a', '/b?x=1']);
  });

  it('back/forward restore the query from the stack', () => {
    const router = Router.new();
    router.goto('/a?x=1');
    router.goto('/b?y=2');

    router.back();
    expect(router.url).toBe('/a?x=1');

    router.forward();
    expect(router.url).toBe('/b?y=2');
  });

  it('match ignores the query string', () => {
    const router = Router.new();
    router.goto('/posts/123?tab=info');
    expect(router.match('/posts', ':id')).not.toBeNull();
  });
});
