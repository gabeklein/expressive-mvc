import { Component } from '@expressive/react';
import { Children, ReactElement, ReactNode, cloneElement, isValidElement } from 'react';

import { Route } from './route';

export interface Match {
  params: Record<string, string>;
}

/**
 * Compose a parent base with a relative or absolute `to` pattern, producing
 * the full pattern used for matching. Absolute `to` (leading `/`) ignores base.
 */
export function fullPattern(base: string, to: string): string {
  if (to.startsWith('/')) return to;
  if (!to) return base;
  return base + '/' + to;
}

/**
 * The "own" portion of a `to` pattern that children compose against as their
 * base. Strips trailing catch-all (`/*` or `*`) since catch-all is for
 * matching, not nesting. Empty / pure catch-all yields ''.
 */
export function patternSegment(to: string): string {
  if (!to || to === '*') return '';
  const slashed = to.startsWith('/') ? to : '/' + to;
  return slashed.replace(/\/?\*$/, '');
}

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

/**
 * Higher score = more specific. Per fixed segment: literal=100, :param=10.
 * Patterns without catch-all get +1 (exact-length match); catch-all gets -1.
 */
function specificity(pattern: string): number {
  const trimmed = pattern.replace(/^\/+|\/+$/g, '');
  const parts = trimmed === '' ? [] : trimmed.split('/');
  const hasCatchAll = parts[parts.length - 1] === '*';
  const fixed = hasCatchAll ? parts.slice(0, -1) : parts;
  let score = hasCatchAll ? -1 : 1;
  for (const p of fixed) score += p.startsWith(':') ? 10 : 100;
  return score;
}

export function matchPattern(pattern: string, path: string): Match | null {
  const patternParts = split(pattern);
  const pathParts = split(path);
  const catchAll = patternParts[patternParts.length - 1] === '*';
  const fixed = catchAll ? patternParts.length - 1 : patternParts.length;

  if (catchAll ? pathParts.length < fixed : pathParts.length !== fixed)
    return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < fixed; i++) {
    const p = patternParts[i];
    const v = pathParts[i];
    if (p.startsWith(':')) params[p.slice(1)] = v;
    else if (p.toLowerCase() !== v.toLowerCase()) return null;
  }

  if (catchAll) params['*'] = pathParts.slice(fixed).join('/');

  return { params };
}

function isRouteElement(child: unknown): child is ReactElement<RouteProps> {
  return isValidElement(child) && child.type === Route;
}

function split(path: string) {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? [] : trimmed.split('/');
}
