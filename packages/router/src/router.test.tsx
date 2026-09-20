import { describe, expect, it } from 'vitest';

import { mockPromise } from '../test.setup';
import { Router } from './router';

async function settle(router: Router) {
  await router.set();
  await Promise.resolve();
}

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

  it('goto pushes onto the stack; back/forward move the cursor', async () => {
    const router = Router.new();
    router.goto('/a');
    await settle(router);
    router.goto('/b');
    await settle(router);
    expect(router.entries).toEqual(['/', '/a', '/b']);

    router.back();
    await settle(router);
    expect(router.path).toBe('/a');
    router.back();
    await settle(router);
    expect(router.path).toBe('/');
    router.forward();
    await settle(router);
    expect(router.path).toBe('/a');
  });

  it('back does nothing at the oldest entry', () => {
    const router = Router.new();
    router.back();
    expect(router.path).toBe('/');
    expect(router.index).toBe(0);
  });

  it('forward does nothing at the newest entry', async () => {
    const router = Router.new();
    router.goto('/a');
    await settle(router);
    router.forward();
    expect(router.path).toBe('/a');
    expect(router.index).toBe(1);
  });

  it('goto drops an empty query', async () => {
    const router = Router.new();
    router.goto('/a?&');
    await settle(router);
    expect(router.path).toBe('/a');
    expect(router.entries).toEqual(['/', '/a']);
  });

  it('url omits query params set to undefined', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    router.query.set('page', undefined as any);
    expect(router.url).toBe('/posts');
  });

  it('goto with replace overwrites the current entry', async () => {
    const router = Router.new();
    router.goto('/a');
    await settle(router);
    router.goto('/b', true);
    await settle(router);
    expect(router.entries).toEqual(['/', '/b']);
    expect(router.path).toBe('/b');
  });

  it('goto after back truncates the forward history', async () => {
    const router = Router.new();
    router.goto('/a');
    await settle(router);
    router.goto('/b');
    await settle(router);
    router.back();
    await settle(router);
    router.goto('/c');
    await settle(router);
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
    await settle(router);
    router.query.set('page', '2');
    await settle(router);

    expect(router.url).toBe('/posts?page=2');
    router.back();
    await settle(router);
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

  it('does not navigate when deleting an absent query param', () => {
    const router = Router.new();

    expect(router.query.delete('missing')).toBe(false);
    expect(router.navigating).toBe(false);
  });

  it('clearing query navigates only when it has entries', async () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    await settle(router);

    router.query.clear();
    await settle(router);

    expect(router.url).toBe('/posts');
    expect(router.entries).toEqual(['/', '/posts?page=2', '/posts']);

    router.query.clear();
    expect(router.navigating).toBe(false);
  });

  it('leaves a destroyed query inert', () => {
    const router = Router.new();
    const { query } = router;
    router.set(null);

    query.set('x', '1');
    expect(query.delete('x')).toBe(true);
    query.clear();
  });

  it('does not duplicate the current history entry', async () => {
    const router = Router.new();
    router.goto('/same');
    await settle(router);
    router.goto('/same');
    await settle(router);

    expect(router.entries).toEqual(['/', '/same']);
  });

  it('assigning url navigates (push)', async () => {
    const router = Router.new();
    router.goto('/a');
    await settle(router);
    router.url = '/b?x=1';
    await settle(router);

    expect(router.path).toBe('/b');
    expect(router.query.get('x')).toBe('1');
    expect(router.entries).toEqual(['/', '/a', '/b?x=1']);
  });

  it('back/forward restore the query from the stack', async () => {
    const router = Router.new();
    router.goto('/a?x=1');
    await settle(router);
    router.goto('/b?y=2');
    await settle(router);

    router.back();
    await settle(router);
    expect(router.url).toBe('/a?x=1');

    router.forward();
    await settle(router);
    expect(router.url).toBe('/b?y=2');
  });

  it('match ignores the query string', () => {
    const router = Router.new();
    router.goto('/posts/123?tab=info');
    expect(router.match('/posts', ':id')).not.toBeNull();
  });
});

describe('navigation settlement', () => {
  it('commits only the latest overlapping navigation', async () => {
    const first = mockPromise<void>();
    const second = mockPromise<void>();
    const gates = [first, second];

    class Test extends Router {
      static global = false;

      protected navigate(work: () => void) {
        work();
        return gates.shift()!;
      }
    }

    const router = Test.new();
    router.goto('/a');
    router.goto('/b');

    expect(router.path).toBe('/b');
    expect(router.entries).toEqual(['/']);
    expect(router.navigating).toBe(true);

    second.resolve();
    await second;
    await Promise.resolve();

    expect(router.entries).toEqual(['/', '/b']);
    expect(router.navigating).toBe(false);

    first.resolve();
    await first;
    await Promise.resolve();

    expect(router.entries).toEqual(['/', '/b']);
    expect(router.path).toBe('/b');
  });

  it('keeps status around an override which does not call super', async () => {
    const gate = mockPromise<void>();

    class Test extends Router {
      static global = false;

      protected navigate(work: () => void) {
        work();
        return gate;
      }
    }

    const router = Test.new();
    router.goto('/next');

    expect(router.navigating).toBe(true);

    gate.resolve();
    await gate;
    await Promise.resolve();

    expect(router.navigating).toBe(false);
  });

  it('does not commit after destruction', async () => {
    const gate = mockPromise<void>();

    class Test extends Router {
      static global = false;

      protected navigate(work: () => void) {
        work();
        return gate;
      }
    }

    const router = Test.new();
    router.goto('/next');
    router.set(null);

    gate.resolve();
    await gate;
    await Promise.resolve();

    expect(router.entries).toEqual(['/']);
  });

  it('clears status when the navigation bracket throws', async () => {
    class Test extends Router {
      static global = false;

      protected navigate(_work: () => void): Promise<void> {
        throw new Error('boom');
      }

      run() {
        return this.next('/next');
      }
    }

    const router = Test.new();

    await expect(router.run()).rejects.toThrow('boom');
    expect(router.navigating).toBe(false);
  });
});
