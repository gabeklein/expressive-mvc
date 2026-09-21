import { Component, map, pending, set, State } from '@expressive/mvc';

import type { Route } from './route';
import {
  Match,
  assertAbsolute,
  fillPath,
  fullPattern,
  isExternal,
  matchPattern,
  normalize,
  patternSegment,
  searchOf
} from './url';

/**
 * Global only on the client. On the server there is no shared singleton, so a
 * per-request `path`/`query` can't bleed across requests; provide a `Router`
 * per-request (via `<Provider>`) to render a specific path there.
 */
const clientOnly: State.Global = () => typeof window !== 'undefined';

interface Navigation {
  navigating: boolean;
  get(key: null): boolean;
}

interface LocationRouter extends Navigation {
  path: string;
  hash: string;
  query: map.Insert<string, string>;
  goto(to: string): void;
}

const ACTIVE = new WeakMap<object, object>();
const LOCATING = new WeakSet<object>();
const READY = new WeakSet<object>();

/**
 * Headless router core: matching plus an in-memory `path` and history stack.
 * Touches no browser globals, so it runs (and tests) under any host - it is
 * also the memory-router substrate. `BrowserRouter` (see `./browser`) binds
 * this to `window.location`/`history`; the public API stays string-based at
 * the edges either way.
 */
export class Router extends Component {
  /** The default router: a client-side singleton a `Route` resolves when no
   * ambient `Router` is provided. See {@link clientOnly}. */
  static readonly global = clientOnly;

  path = '/';

  /**
   * Mechanism for force-404: the concrete path a matched Route declined via its
   * guard (returning `null`). Single-valued and path-keyed - overwritten per
   * forfeit, never accumulates. Matching treats `rejected === path` as not-found.
   */
  rejected = '';

  /**
   * Canonical query state - a reactive map. Read `query.get('foo')` to track a
   * param; write `query.set('foo', ...)` (or `delete`) to navigate: a direct
   * mutation pushes a new history entry, same as if it arrived via `goto`.
   *
   * Keys and values are `string` (URL params carry no other type); a param
   * that is absent reads back as `undefined`.
   */
  query = map<string, string>();

  /** Opaque URL fragment, including its leading `#`, or an empty string. */
  hash = set('', (value) => {
    if (LOCATING.has(this) || !READY.has(this)) return;

    const url = normalize(withQuery(this.path, this.query, value));
    if (this.get(null) || url === this.url) throw false;

    this.goto(url);
    throw false;
  });

  /** In-memory history: visited urls and the cursor into them. */
  protected entries: string[] = [];
  protected index = 0;

  protected new() {
    this.locate(normalize(this.url));
    bindLocation(this);
    this.entries = [this.url];
  }

  /** Full URL as assigned by the environment. Assigning navigates. */
  get url(): string {
    return withQuery(this.path, this.query, this.hash);
  }

  set url(to: string) {
    this.goto(to);
  }

  /**
   * Returns a function that tests a (base, to) pair against the current path.
   *
   * Exposed as a getter so consumers track `path` reactively: reading
   * `router.match(...)` establishes a dependency on the current path via this
   * getter, which is what reactive consumers (Routes, resolvers) rely on.
   */
  get match(): (base: string, to: string) => Match | null {
    const { path } = this;
    return (base, to) => matchPattern(fullPattern(base, to), path);
  }

  goto(to: string, replace = false) {
    assertAbsolute(to);
    this.next(normalize(to), replace);
  }

  /**
   * Commit a navigation: apply `url` as one unit, then record it wherever this
   * router keeps history. Override to bind a different history - `BrowserRouter`
   * writes the address here, once the page is on screen.
   */
  protected async next(url: string, replace?: boolean) {
    await navigate(this, (work) => this.navigate(work), () => {
      this.locate(url);
    }, () => {
      if (replace) this.entries[this.index] = url;
      else if (url !== this.entries[this.index]) {
        this.entries = [...this.entries.slice(0, this.index + 1), url];
        this.index = this.entries.length - 1;
      }
    });
  }

  /** Move back one history entry. */
  back() {
    this.go(-1);
  }

  /** Move by a relative history delta. */
  go(delta: number) {
    delta = deltaOf(delta);
    const index = this.index + delta;

    if (!delta || index < 0 || index >= this.entries.length) return;

    navigate(
      this,
      (work) => this.navigate(work),
      () => this.locate(this.entries[index]),
      () => { this.index = index; }
    );
  }

  /**
   * Whether a navigation has yet to appear. Read it beside the outgoing screen
   * or in a wrapper around it - never inside the page itself, which would
   * render it urgently against the new path and forfeit the hold.
   */
  navigating = false;

  /**
   * Every navigation is applied through here, non-urgent, so a not-yet-ready
   * page holds the current screen rather than flashing its fallback. Override
   * to stage the swap differently (e.g. `document.startViewTransition`) -
   * `work` applies the navigation and must run.
   */
  protected navigate(work: () => void) {
    return pending(work);
  }

  /** Apply a normalized url to state, reconciling location fields in place. */
  protected locate(url: string) {
    LOCATING.add(this);

    try {
      const { pathname, searchParams, hash } = new URL(url, 'x://_');
      this.path = pathname;
      this.hash = hash;

      const { query } = this;
      const next = new Map(searchParams);

      for (const key of [...query.keys()]) if (!next.has(key)) query.delete(key);
      for (const [key, value] of next) query.set(key, value);
    } finally {
      LOCATING.delete(this);
    }
  }

  segment(to: string): string {
    return patternSegment(to);
  }

  /**
   * Directory-style anchor for relative navigation from a Route. Strips trailing
   * `/*` (catch-all, which belongs to children) and substitutes `:params`.
   * Always ends with `/`.
   */
  anchor(route: Route): string {
    // Concrete directory when the Route is on the current path (params filled
    // from it); otherwise its own pattern, base composed - `:params` unfilled.
    const own = fillPath(route.path, this.path) ?? route.path;
    return own.endsWith('/') ? own : own + '/';
  }

  /** Resolve a (possibly relative) url against a Route's anchor. */
  resolve(route: Route, url: string): string {
    if (isExternal(url) || url.startsWith('/')) return url;
    if (url.startsWith('#')) {
      const anchor = this.anchor(route);
      const path = anchor.length > 1 ? anchor.slice(0, -1) : anchor;
      return normalize(withQuery(path, this.query, url));
    }
    const resolved = new URL(url, 'x://_' + this.anchor(route));
    return resolved.pathname + resolved.search + resolved.hash;
  }
}

export async function navigate(
  router: Navigation,
  stage: (work: () => void) => Promise<void>,
  work: () => void,
  commit?: () => void
) {
  const token = {};
  ACTIVE.set(router, token);
  router.navigating = true;

  try {
    await stage(() => {
      if (ACTIVE.get(router) === token && !router.get(null)) work();
    });
    if (ACTIVE.get(router) === token && !router.get(null)) commit?.();
  } finally {
    if (ACTIVE.get(router) === token) {
      ACTIVE.delete(router);
      if (!router.get(null)) router.navigating = false;
    }
  }
}

export function bindLocation(router: LocationRouter) {
  READY.add(router);

  const { query } = router;
  const set = query.set;
  const remove = query.delete;
  const clear = query.clear;

  query.set = function (key, value) {
    if (LOCATING.has(router) || router.get(null))
      return set.call(this, key, value);

    const next = new Map(query);
    next.set(key, value);
    router.goto(withQuery(router.path, next, router.hash));
    return this;
  };

  query.delete = function (key) {
    if (LOCATING.has(router) || router.get(null))
      return remove.call(this, key);
    if (!query.has(key)) return false;

    const next = new Map(query);
    next.delete(key);
    router.goto(withQuery(router.path, next, router.hash));
    return true;
  };

  query.clear = function () {
    if (LOCATING.has(router) || router.get(null)) return clear.call(this);
    if (query.size) router.goto(router.path + router.hash);
  };
}

export function deltaOf(delta: number) {
  return Number.isFinite(delta) ? Math.trunc(delta) : 0;
}

function withQuery(
  path: string,
  query: Iterable<readonly [string, string | undefined]>,
  hash: string
) {
  const search = searchOf(query);
  return (
    path +
    (search ? '?' + search : '') +
    (hash && !hash.startsWith('#') ? '#' + hash : hash)
  );
}
