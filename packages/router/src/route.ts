import { Component, get } from '@expressive/react';
import { ComponentType, ReactNode, createElement } from 'react';

import { Children, isValidElement } from 'react';

import { Match, Router, fullPattern, matchPattern, patternSegment, resolveChild } from './router';

export class Route extends Component {
  to = '';
  /** Base path injected by parent resolver. Empty for top-level Routes. */
  base = '';
  as?: ComponentType<{ children?: ReactNode }> = undefined;

  router = get(Router);

  /** Own portion of `to` that descendants compose against (catch-all stripped). */
  get segment(): string {
    return patternSegment(this.to);
  }

  get match(): Match | null {
    return matchPattern(fullPattern(this.base, this.to), this.router.path);
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
    const children = hasRouteChild(props.children)
      ? resolveChild(props.children, this.base + this.segment, this.router.path)
      : props.children;
    return this.as ? createElement(this.as, {}, children) : children;
  }
}

function hasRouteChild(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (c) => {
    if (isValidElement(c) && c.type === Route) found = true;
  });
  return found;
}