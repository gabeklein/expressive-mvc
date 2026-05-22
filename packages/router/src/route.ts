import { Component, get } from '@expressive/react';
import { ComponentType, ReactNode, createElement } from 'react';

import { Match, Router, matchPattern } from './router';

export class Route extends Component {
  to = '';
  as?: ComponentType<{ children?: ReactNode }> = undefined;

  router = get(Router);
  parent = get(Route, false);

  get match(): Match | null {
    return matchPattern(this.to, this.router.path);
  }

  /**
   * Captured params from the current match. Empty during the transient frame
   * a navigation invalidates this Route's match before the Route unmounts.
   */
  get params(): Record<string, string> {
    return this.match?.params ?? {};
  }

  /**
   * Directory-style anchor for relative navigation. Strips trailing `/*` (catch-all,
   * which belongs to children) and substitutes `:params`. Always ends with `/`.
   */
  get anchor(): string {
    const own = this.to
      .replace(/\/?\*$/, '')
      .replace(/:(\w+)/g, (_, name) => this.params[name]);

    return own.endsWith('/') ? own : own + '/';
  }

  goto(to: string, replace = false) {
    if (to === '' || to === '.') return;

    if (!to.startsWith('/'))
      to = new URL(to, window.location.origin + this.anchor).pathname;

    this.router.goto(to, replace);
  }

  render(props: { children?: ReactNode } = {}) {
    return this.as ? createElement(this.as, {}, props.children) : props.children;
  }
}