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
    const children = hasRouteChild(props.children)
      ? resolveChild(props.children, this.base + this.segment, this.router)
      : props.children;
    return this.as ? createElement(this.as, {}, children) : children;
  }
}

interface RouteProps {
  to?: string;
  base?: string;
}

// Cache cloned elements so React sees stable identity across re-renders.
// Keyed on (original element, base) so same (winner, base) yields the same clone.
const CLONES = new WeakMap<ReactElement, Map<string, ReactElement>>();

/**
 * Pick the most-specific matching Route child for the router's current
 * location, treating each child's `to` as relative to `base`. Returns the
 * React element (or null if none match). Specificity: literal > :param > *.
 * Document order breaks ties.
 */
export function resolveChild(
  children: ReactNode,
  base: string,
  router: Router
): ReactElement | null {
  let match: ReactElement<RouteProps> | null = null;
  let best = -Infinity;

  Children.forEach(children, (child) => {
    if (!isRouteElement(child)) return;
    const pattern = fullPattern(base, child.props.to ?? '');
    if (!router.match(pattern)) return;
    const score = specificity(pattern);
    if (score > best) {
      match = child;
      best = score;
    }
  });

  if (!match) return null;

  if (base) {
    let byBase = CLONES.get(match);
    if (!byBase) CLONES.set(match, (byBase = new Map()));
    let clone = byBase.get(base);
    if (!clone) byBase.set(base, (clone = cloneElement(match, { base })));
    return clone;
  }

  return match;
}

function isRouteElement(child: unknown): child is ReactElement<RouteProps> {
  return isValidElement(child) && child.type === Route;
}

function hasRouteChild(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (c) => {
    if (isValidElement(c) && c.type === Route) found = true;
  });
  return found;
}
