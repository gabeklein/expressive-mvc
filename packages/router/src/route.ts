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
    const next = this.router.match(this.base, this.to);
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
    const { router, as } = this;

    if (!this.match) return null;

    const candidates: Candidate[] = [];
    collectRoutes(children, candidates);

    if (candidates.length)
      children = router.pick(this, candidates)?.el ?? null;

    return as ? createElement(as, {}, children) : children;
  }
}

interface Candidate {
  to: string;
  el: ReactElement<RouteElementProps>;
}

function collectRoutes(children: ReactNode, into: Candidate[]) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment)
      collectRoutes((child.props as { children?: ReactNode }).children, into);
    else if (child.type === Route)
      into.push({
        to: (child.props as RouteElementProps).to ?? '*',
        el: child as ReactElement<RouteElementProps>
      });
  });
}
