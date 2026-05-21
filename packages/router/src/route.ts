import { Component, get } from '@expressive/react';
import { ComponentType, ReactNode, createElement } from 'react';

import { matchPattern, Match } from './matcher';
import { Router } from './router';

export class Route extends Component {
  to = '';
  as: ComponentType<{ children?: ReactNode }> = passthrough;
  fresh = false;

  router = get(Router);

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
    const own = this.to.replace(/\/?\*$/, '');
    const filled = own.replace(/:(\w+)/g, (_, name) => this.params[name]);
    return filled.endsWith('/') ? filled : filled + '/';
  }

  goto(to: string, replace = false) {
    if (to === '' || to === '.') return;
    const resolved = to.startsWith('/')
      ? to
      : new URL(to, window.location.origin + this.anchor).pathname;
    this.router.goto(resolved, replace);
  }

  render(props: { children?: ReactNode } = {}) {
    return createElement(
      this.as,
      this.fresh ? { key: this.router.path } : undefined,
      props.children
    );
  }
}

function passthrough(props: { children?: ReactNode }) {
  return props.children === undefined ? null : props.children;
}
