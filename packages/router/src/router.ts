import { Component } from '@expressive/react';
import { Children, ReactElement, ReactNode, cloneElement, isValidElement } from 'react';

import { Route } from './route';
import { fullPattern, matchPattern, specificity } from './url';

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

  render(props: { children?: ReactNode } = {}) {
    return resolveChild(props.children, '', this.path);
  }
}

/**
 * Pick the most-specific matching Route child for `path`, treating each
 * child's `to` as relative to `base`. Returns the React element (or null if
 * none match). Specificity: literal > :param > *. Document order breaks ties.
 */
export function resolveChild(
  children: ReactNode,
  base: string,
  path: string
): ReactElement | null {
  let best: ReactElement<RouteProps> | null = null;
  let bestScore = -Infinity;

  Children.forEach(children, (child) => {
    if (!isRouteElement(child)) return;
    const pattern = fullPattern(base, child.props.to ?? '');
    if (!matchPattern(pattern, path)) return;
    const score = specificity(pattern);
    if (score > bestScore) {
      best = child;
      bestScore = score;
    }
  });

  if (!best) return null;
  return base ? injectBase(best, base) : best;
}

interface RouteProps {
  to?: string;
  base?: string;
}

// Cache cloned elements so React sees stable identity across re-renders.
// Keyed on (original element, base) so same (winner, base) yields the same clone.
const CLONES = new WeakMap<ReactElement, Map<string, ReactElement>>();

function injectBase(el: ReactElement<RouteProps>, base: string): ReactElement {
  let byBase = CLONES.get(el);
  if (!byBase) CLONES.set(el, (byBase = new Map()));
  let clone = byBase.get(base);
  if (!clone) byBase.set(base, (clone = cloneElement(el, { base })));
  return clone;
}

function isRouteElement(child: unknown): child is ReactElement<RouteProps> {
  return isValidElement(child) && child.type === Route;
}
