import { Component, get, set } from '@expressive/react';
import {
  Children,
  ComponentType,
  Fragment,
  ReactElement,
  ReactNode,
  createElement,
  isValidElement
} from 'react';

import { Router } from './router';

interface RouteElementProps {
  to?: string;
}

const PARAMS = new WeakMap<Route, Record<string, string> | undefined>();

export class Route extends Component {
  router = set(() => this.get(Router, false) || new Router());

  as?: ComponentType<{ children?: ReactNode }> = undefined;

  to: string = '*';

  /** Nearest mounted Route ancestor, if any. */
  parent = get(Route, false);

  /** Base path inherited from parent Route (empty at the root). */
  get base(): string {
    const { parent } = this;
    return parent ? parent.base + this.router.segment(parent.to) : '';
  }

  /**
   * Captured params from the current match, or `undefined` when this Route's
   * pattern does not match the current path. Stable identity across reads when
   * captures are unchanged.
   */
  get match(): Record<string, string> | undefined {
    const next = this.router.match(this.base, this.to)?.params;
    const has = PARAMS.has(this);
    const prev = PARAMS.get(this);

    if (has && !next === !prev) {
      if (!next) return prev;
      const keys = Object.keys(next);
      if (keys.length === Object.keys(prev!).length && keys.every(k => prev![k] === next[k]))
        return prev;
    }

    PARAMS.set(this, next);
    return next;
  }

  /** Directory-style anchor for relative navigation. */
  get anchor(): string {
    return this.router.anchor(this);
  }

  resolve(url: string): string {
    return this.router.resolve(this, url);
  }

  goto(url: string, replace = false) {
    if (url === '' || url === '.') return;
    this.router.goto(this.resolve(url), replace);
  }

  render({ children } = {} as { children?: ReactNode }) {
    const { router, as, base, to } = this;

    if (!this.match) return null;

    let winner: ReactElement<RouteElementProps> | null = null;
    let hasRoute = false;
    let best = -Infinity;
    const childBase = base + router.segment(to);

    forEachRouteChild(children, (el) => {
      hasRoute = true;
      const m = router.match(childBase, el.props.to ?? '*');
      if (m && m.score > best) {
        winner = el;
        best = m.score;
      }
    });

    if (hasRoute) children = winner;

    return as ? createElement(as, {}, children) : children;
  }
}

function forEachRouteChild(
  children: ReactNode,
  fn: (el: ReactElement<RouteElementProps>) => void
) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment)
      forEachRouteChild((child.props as { children?: ReactNode }).children, fn);
    else if (child.type === Route)
      fn(child as ReactElement<RouteElementProps>);
  });
}
