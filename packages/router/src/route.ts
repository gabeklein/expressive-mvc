import { Component, get } from '@expressive/react';
import {
  Children,
  ComponentType,
  ReactElement,
  ReactNode,
  cloneElement,
  createElement,
  isValidElement
} from 'react';

import { Router } from './router';
interface RouteProps {
  children?: ReactNode;
  /** Base path injected by parent resolver. Empty for top-level Routes. */
  base?: string;
}

interface RouteElementProps {
  to?: string;
  base?: string;
}

// Cache cloned elements so React sees stable identity across re-renders.
// Keyed on (original element, base) so same (winner, base) yields the same clone.
const CLONES = new WeakMap<ReactElement, Map<string, ReactElement>>();

export class Route extends Component {
  router = get(Router);

  as?: ComponentType<{ children?: ReactNode }> = undefined;

  to: string = '*';

  /**
   * Captured params from the current match. Empty during the transient frame
   * a navigation invalidates this Route's match before the Route unmounts.
   */
  get params(): Record<string, string> {
    const { base = '' } = this.props as RouteProps;
    return this.router.match(base, this.to)?.params ?? {};
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

  render({ base = "", children } = {} as RouteProps) {
    const { router, as } = this;

    let winner: ReactElement<RouteElementProps> | null = null;
    let hasRoute = false;
    let best = -Infinity;

    base += router.segment(this.to);

    Children.forEach(children, (child) => {
      if (!isValidElement(child) || child.type !== Route) return;
      hasRoute = true;
      const el = child as ReactElement<RouteElementProps>;
      const m = router.match(base, el.props.to ?? '*');
      if (m && m.score > best) {
        winner = el;
        best = m.score;
      }
    });

    if (hasRoute) children = resolved(winner, base);

    return as ? createElement(as, {}, children) : children;
  }
}

function resolved(
  winner: ReactElement<RouteElementProps> | null,
  base: string
): ReactElement | null {
  if (!winner) return null;
  if (!base) return winner;

  let byBase = CLONES.get(winner);
  if (!byBase) CLONES.set(winner, (byBase = new Map()));

  let clone = byBase.get(base);
  if (!clone) byBase.set(base, (clone = cloneElement(winner, { base })));
  return clone;
}
