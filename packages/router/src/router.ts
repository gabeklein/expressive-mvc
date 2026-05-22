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

  /**
   * Returns a function that tests a (base, to) pair against the current location.
   *
   * Exposed as a getter so consumers track `path` reactively: reading
   * `router.match(...)` establishes a dependency on the current URL via this
   * getter, which is what reactive consumers (Routes, resolvers) rely on.
   */
  get match(): (base: string, to: string) => Match | null {
    const { path } = this;
    return (base, to) => matchPattern(fullPattern(base, to), path);
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
      .replace(/:(\w+)/g, (_, name) => route.params[name]);

    return own.endsWith('/') ? own : own + '/';
  }

  /** Resolve a (possibly relative) url against a Route's anchor; returns absolute pathname. */
  resolve(route: Route, url: string): string {
    if (url.startsWith('/')) return url;
    return new URL(url, 'x://_' + this.anchor(route)).pathname;
  }

  render(props: { children?: ReactNode } = {}) {
    return createElement(Route, {}, props.children);
  }
}
