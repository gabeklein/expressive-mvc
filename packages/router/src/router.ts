import { Component } from '@expressive/react';
import { ReactNode, createElement } from 'react';

import { Route } from './route';
import { Match, fullPattern, matchPattern, patternSegment } from './url';

export class Router extends Component {
  path = window.location.pathname;

  protected new() {
    const sync = () => {
      this.path = window.location.pathname;
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }

  goto(to: string, replace = false) {
    if (!to.startsWith('/'))
      throw new Error(
        `Router.goto requires an absolute path; got "${to}". Relative paths must be resolved via a Route (e.g. Route.get().goto).`
      );

    const url = new URL(to, window.location.origin);
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    this.path = url.pathname;
  }

  /**
   * Returns a function that tests a (base, to) pair against the current location.
   *
   * Exposed as a getter so consumers track `path` reactively: reading
   * `router.match(...)` establishes a dependency on the current URL via this
   * getter, which is what reactive consumers (Routes, resolvers) rely on.
   */
  get match(): (base: string, to: string) => Match | null {
    const path = this.path;
    return (base, to) => matchPattern(fullPattern(base, to), path);
  }

  childBase(base: string, to: string): string {
    return base + patternSegment(to);
  }

  /**
   * Directory-style anchor for relative navigation from a Route. Strips trailing
   * `/*` (catch-all, which belongs to children) and substitutes `:params`.
   * Always ends with `/`.
   */
  anchor(to: string, params: Record<string, string>): string {
    const own = to
      .replace(/\/?\*$/, '')
      .replace(/:(\w+)/g, (_, name) => params[name]);

    return own.endsWith('/') ? own : own + '/';
  }

  /** Resolve a (possibly relative) `to` against an anchor; returns absolute pathname. */
  resolve(to: string, anchor: string): string {
    if (to.startsWith('/')) return to;
    return new URL(to, window.location.origin + anchor).pathname;
  }

  render(props: { children?: ReactNode } = {}) {
    return createElement(Route, { to: '*' }, props.children);
  }
}
