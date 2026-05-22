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
  let bestScore = -1;

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
  return base ? cloneElement(best, { base }) : best;
}

interface RouteProps {
  to?: string;
  base?: string;
}

/** Higher score = more specific. literal=4, :param=2, *=1 per segment. */
function specificity(pattern: string): number {
  const trimmed = pattern.replace(/^\/+|\/+$/g, '');
  if (trimmed === '') return 0;
  let score = 0;
  for (const p of trimmed.split('/')) {
    if (p === '*') score += 1;
    else if (p.startsWith(':')) score += 2;
    else score += 4;
  }
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
