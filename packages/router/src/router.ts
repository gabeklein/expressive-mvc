import { Component } from '@expressive/mvc';

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

  /** Raw query string, no leading `?` - mirrors `URLSearchParams` input. */
  search = '';

  /** In-memory history: visited urls (path + query) and the cursor into them. */
  entries: string[] = [];
  index = 0;

  protected new() {
    this.entries = [this.path];
  }

  /** Parsed view of `search`; recomputed reactively when it changes. */
  get query(): URLSearchParams {
    return new URLSearchParams(this.search);
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

    if (replace)
      this.entries[this.index] = url;
    else {
      this.entries = [...this.entries.slice(0, this.index + 1), url];
      this.index = this.entries.length - 1;
    }

    this.locate(url);
  }

  back() {
    if (this.index > 0)
      this.locate(this.entries[--this.index]);
  }

  forward() {
    if (this.index < this.entries.length - 1)
      this.locate(this.entries[++this.index]);
  }

  /** Apply a normalized url (path + optional `?query`) to state. */
  protected locate(url: string) {
    const q = url.indexOf('?');
    this.path = q < 0 ? url : url.slice(0, q);
    this.search = q < 0 ? '' : url.slice(q + 1);
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

/** Binds the headless core to `window.location`, syncing `path` on navigation. */
export class BrowserRouter extends Router {
  path = window.location.pathname;
  search = window.location.search.slice(1);

  goto(to: string, replace = false) {
    assertAbsolute(to);
    history[replace ? 'replaceState' : 'pushState'](null, '', normalize(to));
  }

  // The browser owns the history stack; back/forward delegate to it (popstate
  // syncs `path`), so the inherited in-memory entries/index go unused here.
  back() {
    history.back();
  }

  forward() {
    history.forward();
  }

  protected new() {
    const sync = () => {
      this.path = window.location.pathname;
      this.search = window.location.search.slice(1);
    };
    window.addEventListener('popstate', sync);

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args) => { origPush(...args); sync(); };
    history.replaceState = (...args) => { origReplace(...args); sync(); };

    return () => {
      window.removeEventListener('popstate', sync);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }
}

function assertAbsolute(to: string) {
  if (!to.startsWith('/'))
    throw new Error(
      `Router.goto requires an absolute path; got "${to}". Relative paths must be resolved via a Route (e.g. Route.get().goto).`
    );
}

/** Collapse `.`/`..` and stray slashes without touching browser globals; keeps the query. */
function normalize(to: string): string {
  const url = new URL(to, 'x://_');
  return url.pathname + url.search;
}
