import { Component } from '@expressive/react';
import { ReactNode, createElement } from 'react';

import { Route } from './route';
import { Match, matchPattern } from './url';

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
   * Returns a function that tests patterns against the current location.
   *
   * Exposed as a getter so consumers track `path` reactively: reading
   * `router.match(...)` establishes a dependency on the current URL via this
   * getter, which is what reactive consumers (Routes, resolvers) rely on.
   */
  get match(): (pattern: string) => Match | null {
    const path = this.path;
    return (pattern) => matchPattern(pattern, path);
  }

  render(props: { children?: ReactNode } = {}) {
    return createElement(Route, { to: '*' }, props.children);
  }
}
