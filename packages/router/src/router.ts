import { Component, hot, listener } from '@expressive/mvc';

import { Route } from './route';
import { Match, fullPattern, matchPattern, patternSegment } from './url';

/**
 * Headless router core: matching plus an in-memory `path` and history stack.
 * Touches no browser globals, so it runs (and tests) under any host - it is
 * also the memory-router substrate. `BrowserRouter` binds this to
 * `window.location`/`history`; the public API stays string-based at the edges
 * either way.
 */
export class Router extends Component {
  path = '/';

  /**
   * Canonical query state - a reactive record. Read `query.foo` to track a
   * param; write `query.foo = ...` (or delete) to navigate: a direct mutation
   * pushes a new history entry, same as if it arrived via `goto`.
   *
   * Values are always `string | undefined` (URL params carry no other type).
   * A subclass may narrow the known keys by redeclaring with `declare`:
   *
   * ```ts
   * class Search extends Router {
   *   declare query: { q?: string; page?: string };
   * }
   * ```
   */
  query = hot({} as Record<string, string | undefined>);

  /** In-memory history: visited urls (path + query) and the cursor into them. */
  entries: string[] = [];
  index = 0;

  protected new() {
    this.entries = [this.url];
    // Direct `query` mutations push a new entry; URL-driven changes already sit there (pushEntry no-ops).
    const release = listener(this.query, () => pushEntry(this, this.url), false);

    return () => {
      release();
    };
  }

  /** Full URL as assigned by the environment (path + optional `?query`). Assigning navigates. */
  get url(): string {
    const search = searchOf(this.query);
    return search ? this.path + '?' + search : this.path;
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
    const url = normalize(to);

    if (replace) this.entries[this.index] = url;
    else pushEntry(this, url);

    this.locate(url);
  }

  back() {
    if (this.index > 0) this.locate(this.entries[--this.index]);
  }

  forward() {
    if (this.index < this.entries.length - 1)
      this.locate(this.entries[++this.index]);
  }

  /** Apply a normalized url (path + optional `?query`) to state, reconciling `query` in place. */
  protected locate(url: string) {
    const q = url.indexOf('?');
    this.path = q < 0 ? url : url.slice(0, q);

    const { query } = this;
    const next = Object.fromEntries(
      new URLSearchParams(q < 0 ? '' : url.slice(q + 1))
    );

    for (const key in query) if (!(key in next)) delete query[key];

    Object.assign(query, next);
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
    const own = route.to
      .replace(/\/?\*$/, '')
      .replace(/:(\w+)/g, (_, name) => route.match![name]);

    return own.endsWith('/') ? own : own + '/';
  }

  /** Resolve a (possibly relative) url against a Route's anchor; returns absolute pathname. */
  resolve(route: Route, url: string): string {
    if (url.startsWith('/')) return url;
    return new URL(url, 'x://_' + this.anchor(route)).pathname;
  }
}

/** Binds the headless core to `window.location`, syncing `path`/`query` on navigation. */
export class BrowserRouter extends Router {
  path = window.location.pathname;

  goto(to: string, replace = false) {
    assertAbsolute(to);
    history[replace ? 'replaceState' : 'pushState'](null, '', normalize(to));
  }

  // The browser owns the history stack; back/forward delegate to it (popstate
  // syncs path/query), so the inherited in-memory entries/index go unused here.
  back() {
    history.back();
  }

  forward() {
    history.forward();
  }

  protected new() {
    const sync = () => {
      this.locate(window.location.pathname + window.location.search);
    };
    sync();
    window.addEventListener('popstate', sync);

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args) => {
      origPush(...args);
      sync();
    };
    history.replaceState = (...args) => {
      origReplace(...args);
      sync();
    };

    // Direct `query` writes push to the browser's history; URL-driven changes
    // already match (compared canonically, so encoding differences don't dup).
    const release = listener(
      this.query,
      () => {
        const { url } = this;
        if (url !== canonicalize(window.location.pathname + window.location.search))
          history.pushState(null, '', url);
      },
      false
    );

    return () => {
      release();
      window.removeEventListener('popstate', sync);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }
}

/** Append `url` as a new history entry on a memory router, truncating any forward stack. */
function pushEntry(router: Router, url: string) {
  if (url === router.entries[router.index]) return;

  router.entries = [...router.entries.slice(0, router.index + 1), url];
  router.index = router.entries.length - 1;
}

function assertAbsolute(to: string) {
  if (!to.startsWith('/'))
    throw new Error(
      `Router.goto requires an absolute path; got "${to}". Relative paths must be resolved via a Route (e.g. Route.get().goto).`
    );
}

/**
 * Collapse `.`/`..` and stray slashes without touching browser globals, and
 * canonicalize the query so stored urls match the `url` getter byte-for-byte.
 */
function normalize(to: string): string {
  const { pathname, search } = new URL(to, 'x://_');
  return canonicalize(pathname + search);
}

/**
 * Re-serialize a url's query through the record model (last value per key,
 * `URLSearchParams` encoding) so it is identical to what the `url` getter emits.
 * This is what makes the history-dedup a sound string comparison.
 */
function canonicalize(url: string): string {
  const q = url.indexOf('?');
  if (q < 0) return url;

  const search = searchOf(Object.fromEntries(new URLSearchParams(url.slice(q + 1))));
  return search ? url.slice(0, q) + '?' + search : url.slice(0, q);
}

/** Canonical query serialization: skips `undefined`, last-value-per-key, form encoding. */
function searchOf(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();

  for (const key in query) {
    const value = query[key];
    if (value !== undefined) params.append(key, value);
  }

  return params.toString();
}
