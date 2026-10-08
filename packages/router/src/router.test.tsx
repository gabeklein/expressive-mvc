import { describe, expect, it } from 'vitest';

import { mockPromise } from '../test.setup';
import { Router as CoreRouter } from './router';

type Gate = ReturnType<typeof mockPromise<void>>;

class Router extends CoreRouter {
  static readonly global: (typeof CoreRouter)['global'] = false;
  declare public entries: string[];
  declare public index: number;
}

async function settle(router: Router) {
  await router.set();
  await Promise.resolve();
}

async function walk(router: Router, ...steps: (string | number)[]) {
  for (const step of steps) {
    if (typeof step === 'string') router.goto(step);
    else router.go(step);
    await settle(router);
  }
}

async function release(gate: Gate) {
  gate.resolve();
  await gate;
  await Promise.resolve();
}

const gated = (...gates: Gate[]) =>
  class extends Router {
    protected navigate(work: () => void) {
      const gate = gates.shift()!;
      gate.then(work);
      return gate;
    }
  };

const eager = (gate: Gate) =>
  class extends Router {
    protected navigate(work: () => void) {
      work();
      return gate;
    }
  };

describe('Router (headless)', () => {
  it('will default to root', () => {
    const router = Router.new();
    expect(router.path).toBe('/');
    expect(router.hash).toBe('');
    expect(router.url).toBe('/');
  });

  it('goto will update path in memory', async () => {
    const router = Router.new();
    await walk(router, '/bar');
    expect(router.path).toBe('/bar');
    expect(router.url).toBe('/bar');
    expect(router.entries).toEqual(['/', '/bar']);
  });

  it('goto will normalize . and ..', async () => {
    const router = Router.new();
    await walk(router, '/posts/foo/../bar');
    expect(router.path).toBe('/posts/bar');
    expect(router.url).toBe('/posts/bar');
    expect(router.entries).toEqual(['/', '/posts/bar']);
  });

  it('goto will split query from path', async () => {
    const router = Router.new();
    await walk(router, '/posts?page=2&sort=asc');
    expect(router.path).toBe('/posts');
    expect(router.url).toBe('/posts?page=2&sort=asc');
    expect(router.entries).toEqual(['/', '/posts?page=2&sort=asc']);
  });

  it('goto will drop an empty query', async () => {
    const router = Router.new();
    await walk(router, '/a?&');
    expect(router.path).toBe('/a');
    expect(router.url).toBe('/a');
    expect(router.entries).toEqual(['/', '/a']);
  });

  it('goto will canonicalize the query so navigation does not push a duplicate entry', async () => {
    const encoded = Router.new();
    await walk(encoded, '/x?q=a%20b');
    expect(encoded.path).toBe('/x');
    expect(encoded.url).toBe('/x?q=a+b');
    expect(encoded.entries).toEqual(['/', '/x?q=a+b']);
    encoded.set(null);

    const repeated = Router.new();
    await walk(repeated, '/x?a=1&a=2');
    expect(repeated.path).toBe('/x');
    expect(repeated.url).toBe('/x?a=2');
    expect(repeated.entries).toEqual(['/', '/x?a=2']);
  });

  it('goto will preserve an opaque fragment after canonical query', async () => {
    const router = Router.new();
    await walk(router, '/docs?q=a%20b#install');
    expect(router.path).toBe('/docs');
    expect(router.url).toBe('/docs?q=a+b#install');
    expect(router.entries).toEqual(['/', '/docs?q=a+b#install']);
  });

  it('will throw on relative goto', () => {
    expect(() => Router.new().goto('./x')).toThrow(/absolute path/);
  });

  it('will seed the history stack from the initial path', () => {
    const router = Router.new({ path: '/start', hash: 'section one' });
    expect(router.hash).toBe('#section%20one');
    expect(router.entries).toEqual(['/start#section%20one']);
    expect(router.index).toBe(0);
  });

  it('will push on goto and move the cursor with back and go', async () => {
    const router = Router.new();
    expect((router as any).forward).toBeUndefined();
    await walk(router, '/a', '/b');
    expect(router.entries).toEqual(['/', '/a', '/b']);

    await walk(router, -1);
    expect(router.path).toBe('/a');
    await walk(router, -1);
    expect(router.path).toBe('/');
    await walk(router, 1);
    expect(router.path).toBe('/a');
  });

  it('will ignore back and go outside the history bounds', async () => {
    const router = Router.new();
    router.back();
    expect(router.index).toBe(0);

    await walk(router, '/a');
    router.go(1);
    router.go(-2);
    expect(router.path).toBe('/a');
    expect(router.index).toBe(1);
  });

  it('will truncate go deltas and ignore zero or non-finite ones', async () => {
    const router = Router.new();
    await walk(router, '/a', '/b', -1.9);
    expect(router.path).toBe('/a');

    await walk(router, 1.9);
    expect(router.path).toBe('/b');

    router.go(0);
    router.go(Number.NaN);
    router.go(Number.POSITIVE_INFINITY);
    expect(router.path).toBe('/b');
    expect(router.navigating).toBe(false);
  });

  it('will restore query and fragment from the stack', async () => {
    const router = Router.new();
    await walk(router, '/a?x=1#first', '/b?y=2#second', -1);
    expect(router.url).toBe('/a?x=1#first');

    await walk(router, 1);
    expect(router.url).toBe('/b?y=2#second');
  });

  it('will overwrite the current entry on replace', async () => {
    const router = Router.new();
    await walk(router, '/a');
    router.goto('/b', true);
    await settle(router);
    expect(router.entries).toEqual(['/', '/b']);
    expect(router.path).toBe('/b');
  });

  it('will truncate forward history on goto after back', async () => {
    const router = Router.new();
    await walk(router, '/a', '/b', -1, '/c');
    expect(router.entries).toEqual(['/', '/a', '/c']);
    expect(router.path).toBe('/c');
  });

  it('will not duplicate the current history entry', async () => {
    const router = Router.new();
    await walk(router, '/same', '/same');
    expect(router.entries).toEqual(['/', '/same']);
  });

  it('will clear query and fragment when goto omits them', async () => {
    const router = Router.new();
    await walk(router, '/docs?page=2#install', '/docs');
    expect(router.hash).toBe('');
    expect(router.url).toBe('/docs');
  });

  it('will navigate (push) on url assignment', async () => {
    const router = Router.new();
    await walk(router, '/a');
    router.url = '/b?x=1';
    await settle(router);

    expect(router.path).toBe('/b');
    expect(router.query.get('x')).toBe('1');
    expect(router.entries).toEqual(['/', '/a', '/b?x=1']);
  });

  it('will expose decoded query params', () => {
    const router = Router.new();
    router.goto('/posts?q=a%20b');
    expect(router.query.get('q')).toBe('a b');
  });

  it('will omit query params set to undefined from url', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    router.query.set('page', undefined as any);
    expect(router.url).toBe('/posts');
  });

  it('will update query reactively when search changes', async () => {
    const router = Router.new();
    const seen: (string | undefined)[] = [];
    router.get(state => void seen.push(state.query.get('page')));

    await walk(router, '/posts?page=1', '/posts?page=2');
    expect(seen).toEqual([undefined, '1', '2']);
  });

  it('will push a history entry when writing a query param', async () => {
    const router = Router.new();
    await walk(router, '/posts?page=1');
    router.query.set('page', '2');
    await settle(router);

    expect(router.entries).toEqual(['/', '/posts?page=1', '/posts?page=2']);
    await walk(router, -1);
    expect(router.url).toBe('/posts?page=1');
  });

  it('will preserve the fragment when writing a query param', async () => {
    const router = Router.new();
    await walk(router, '/posts#results');
    router.query.set('page', '2');
    await settle(router);
    expect(router.url).toBe('/posts?page=2#results');

    router.query.clear();
    await settle(router);
    expect(router.url).toBe('/posts#results');
  });

  it('will navigate on delete only for a present query param', async () => {
    const router = Router.new();
    router.goto('/posts?page=2&sort=asc');
    expect(router.query.delete('sort')).toBe(true);
    await router.set();
    expect(router.url).toBe('/posts?page=2');

    expect(router.query.delete('missing')).toBe(false);
    expect(router.navigating).toBe(false);
  });

  it('will navigate on clear only when the query has entries', async () => {
    const router = Router.new();
    await walk(router, '/posts?page=2');
    router.query.clear();
    await settle(router);

    expect(router.url).toBe('/posts');
    expect(router.entries).toEqual(['/', '/posts?page=2', '/posts']);

    router.query.clear();
    expect(router.navigating).toBe(false);
  });

  it('will stop tracking query once destroyed', async () => {
    const router = Router.new();
    router.goto('/posts');
    await router.set();
    router.set(null);

    expect(router.get(null)).toBe(true);
    expect(router.entries).toEqual(['/', '/posts']);
  });

  it('will leave a destroyed query inert', () => {
    const router = Router.new();
    const { query } = router;
    router.set(null);

    query.set('x', '1');
    expect(query.delete('x')).toBe(true);
    query.clear();
  });

  it('will navigate on hash assignment, normalizing the marker', async () => {
    const router = Router.new();
    await walk(router, '/docs?mode=api#intro');

    router.hash = 'install guide';
    expect(router.navigating).toBe(true);
    await settle(router);

    expect(router.url).toBe('/docs?mode=api#install%20guide');
    expect(router.entries).toEqual([
      '/',
      '/docs?mode=api#intro',
      '/docs?mode=api#install%20guide'
    ]);

    router.hash = '#install%20guide';
    expect(router.navigating).toBe(false);
  });

  it('will react to fragment changes', async () => {
    const router = Router.new();
    const seen: string[] = [];
    router.get(state => void seen.push(state.hash));

    await walk(router, '/docs#one');
    router.hash = '#two';
    await settle(router);

    expect(seen).toEqual(['', '#one', '#two']);
  });

  it('will leave hash inert after destruction', () => {
    const router = Router.new({ hash: '#before' });
    router.set(null);
    router.hash = '#after';
    expect(router.hash).toBe('#before');
  });

  it('will match ignoring query and fragment', () => {
    const router = Router.new();
    router.goto('/posts/123?tab=info#comments');
    expect(router.match('/posts', ':id')).not.toBeNull();
  });
});

describe('Router navigation settlement', () => {
  it('will commit only the latest overlapping history traversal', async () => {
    const first = mockPromise<void>();
    const second = mockPromise<void>();
    const router = gated(first, second).new();

    router.entries = ['/', '/a', '/b'];
    router.index = 2;
    (router as any).locate('/b');

    router.go(-1);
    router.go(-2);
    expect(router.path).toBe('/b');
    expect(router.index).toBe(2);
    expect(router.navigating).toBe(true);

    await release(second);
    expect(router.path).toBe('/');
    expect(router.index).toBe(0);
    expect(router.navigating).toBe(false);

    await release(first);
    expect(router.path).toBe('/');
    expect(router.index).toBe(0);
  });

  it('will commit only the latest overlapping navigation', async () => {
    const first = mockPromise<void>();
    const second = mockPromise<void>();
    const router = gated(first, second).new();

    router.goto('/a');
    router.goto('/b');
    expect(router.path).toBe('/');
    expect(router.entries).toEqual(['/']);
    expect(router.navigating).toBe(true);

    await release(second);
    expect(router.entries).toEqual(['/', '/b']);
    expect(router.path).toBe('/b');
    expect(router.navigating).toBe(false);

    await release(first);
    expect(router.entries).toEqual(['/', '/b']);
    expect(router.path).toBe('/b');
  });

  it('will settle fragment assignment before committing history', async () => {
    const gate = mockPromise<void>();
    const router = gated(gate).new();

    router.hash = '#details';
    expect(router.hash).toBe('');
    expect(router.entries).toEqual(['/']);
    expect(router.navigating).toBe(true);

    await release(gate);
    expect(router.hash).toBe('#details');
    expect(router.entries).toEqual(['/', '/#details']);
    expect(router.navigating).toBe(false);
  });

  it('will keep status around an override which does not call super', async () => {
    const gate = mockPromise<void>();
    const router = eager(gate).new();

    router.goto('/next');
    expect(router.navigating).toBe(true);

    await release(gate);
    expect(router.navigating).toBe(false);
  });

  it('will not commit after destruction', async () => {
    const gate = mockPromise<void>();
    const router = eager(gate).new();

    router.goto('/next');
    router.set(null);

    await release(gate);
    expect(router.entries).toEqual(['/']);
  });

  it('will clear status when the navigation bracket throws', async () => {
    class Test extends Router {
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
