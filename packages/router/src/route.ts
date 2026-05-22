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
import { Match, fullPattern, patternSegment, specificity } from './url';

interface RouteProps {
  to?: string;
  base?: string;
}

// Cache cloned elements so React sees stable identity across re-renders.
// Keyed on (original element, base) so same (winner, base) yields the same clone.
const CLONES = new WeakMap<ReactElement, Map<string, ReactElement>>();

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
    return this.router.match(fullPattern(this.base, this.to));
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
    const { router, as } = this;
    const childBase = this.base + this.segment;

    let winner: ReactElement<RouteProps> | null = null;
    let hasRoute = false;
    let best = -Infinity;

    Children.forEach(props.children, (child) => {
      if (!isValidElement(child) || child.type !== Route) return;
      hasRoute = true;
      const el = child as ReactElement<RouteProps>;
      const pattern = fullPattern(childBase, el.props.to ?? '');
      if (router.match(pattern)) {
        const score = specificity(pattern);
        if (score > best) {
          winner = el;
          best = score;
        }
      }
    });

    const children = hasRoute ? resolved(winner, childBase) : props.children;
    return as ? createElement(as, {}, children) : children;
  }
}

function resolved(
  winner: ReactElement<RouteProps> | null,
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
