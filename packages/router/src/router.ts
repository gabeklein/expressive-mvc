import { State } from '@expressive/react';

import { Route } from './route';
import { fullPattern, matchPattern, patternSegment } from './url';

export class Router extends State {
  path = window.location.pathname;

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

  /**
   * Returns a function that tests a (base, to) pair against the current location.
   *
   * Exposed as a getter so consumers track `path` reactively: reading
   * `router.match(...)` establishes a dependency on the current URL via this
   * getter, which is what reactive consumers (Routes, resolvers) rely on.
   */
  get match(): (base: string, to: string) => Record<string, string> | undefined {
    const { path } = this;
    return (base, to) => matchPattern(fullPattern(base, to), path)?.params;
  }

  /**
   * Pick the highest-scored matching candidate among `children` under `from`'s
   * own base. Returns the winning candidate, or `null` if none match. Ties
   * break by document order (first wins).
   */
  get pick() {
    const { path } = this;
    return <C extends { to: string }>(from: Route, children: C[]): C | null => {
      const base = from.base + patternSegment(from.to);
      let best = -Infinity;
      let winner: C | null = null;

      for (const c of children) {
        const m = matchPattern(fullPattern(base, c.to), path);
        if (m && m.score > best) {
          best = m.score;
          winner = c;
        }
      }

      return winner;
    };
  }

  goto(to: string, replace = false) {
    if (!to.startsWith('/'))
      throw new Error(
        `Router.goto requires an absolute path; got "${to}". Relative paths must be resolved via a Route (e.g. Route.get().goto).`
      );

    const url = new URL(to, window.location.origin);
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
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
