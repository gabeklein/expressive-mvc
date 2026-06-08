import { Component } from '@expressive/react';

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

  /** In-memory history: visited paths and the cursor into them. */
  entries: string[] = [];
  index = 0;

  protected new() {
    this.entries = [this.path];
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
    const path = normalize(to);

    if (replace)
      this.entries[this.index] = path;
    else {
      this.entries = [...this.entries.slice(0, this.index + 1), path];
      this.index = this.entries.length - 1;
    }

    this.path = path;
  }

  back() {
    if (this.index > 0)
      this.path = this.entries[--this.index];
  }

  forward() {
    if (this.index < this.entries.length - 1)
      this.path = this.entries[++this.index];
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

/** Collapse `.`/`..` and stray slashes without touching browser globals. */
function normalize(to: string): string {
  return new URL(to, 'x://_').pathname;
}
