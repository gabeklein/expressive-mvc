import { Component, Context, get } from '@expressive/react';
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

export class Route extends Component {
  router = get(Router);

  as?: ComponentType<{ children?: ReactNode }> = undefined;

  to: string = '*';

  /** Nearest mounted Route ancestor, if any. Resolved via React context. */
  get parent(): Route | undefined {
    return Context.get(this).parent?.get(Route, false);
  }

  /** Base path inherited from parent Route (empty at the root). */
  get base(): string {
    const { parent } = this;
    return parent ? parent.base + this.router.segment(parent.to) : '';
  }

  /**
   * Captured params from the current match. Empty during the transient frame
   * a navigation invalidates this Route's match before the Route unmounts.
   */
  get params(): Record<string, string> {
    return this.router.match(this.base, this.to)?.params ?? {};
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
