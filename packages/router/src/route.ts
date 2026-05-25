import { Component, get, set } from '@expressive/react';
import { ComponentType, ReactNode, createElement } from 'react';

import { Router } from './router';

const PARAMS = new WeakMap<Route, Record<string, string> | undefined>();
const ROUTES = new WeakMap<Route, Route[]>();
const REGISTERED = new WeakMap<Route, Route>();
const SCHEDULED = new WeakSet<Route>();

export class Route extends Component {
  router = set(() => this.get(Router, false) || new Router());

  as?: ComponentType<{ children?: ReactNode }> = undefined;

  to: string = '*';

  /** Nearest mounted Route ancestor, if any. */
  parent = get(Route, false);

  /** Non-enumerable tick used to refresh sibling selection after registration changes. */
  revision = set(0);

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
      if (
        keys.length === Object.keys(prev!).length &&
        keys.every((k) => prev![k] === next[k])
      )
        return prev;
    }

    PARAMS.set(this, next);
    return next;
  }

  /** True when this Route should render its own branch. */
  get active(): boolean {
    this.revision;
    const parent = this.parent?.is;

    if (parent) register(parent, this.is);
    if (!this.match) return false;
    if (!parent || !this.as) return true;
    return routes(parent).length === 0 || selected(parent) === this.is;
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
    const { as } = this;

    if (!this.active) return null;
    return as ? createElement(as, {}, children) : children;
  }
}

function routes(route: Route): Route[] {
  route.revision;
  return ROUTES.get(route)!;
}

function selected(route: Route): Route | undefined {
  let winner: Route | undefined;
  let best = -Infinity;

  for (const child of routes(route)) {
    if (!child.as) continue;

    const match = route.router.match(child.base, child.to);
    if (match && match.score > best) {
      winner = child;
      best = match.score;
    }
  }

  return winner;
}

function register(parent: Route, route: Route) {
  if (REGISTERED.get(route) === parent) return;

  REGISTERED.set(route, parent);

  const routes = ROUTES.get(parent) ?? [];
  if (!routes.includes(route)) {
    routes.push(route);
    ROUTES.set(parent, routes);
    refresh(parent);
  }

  route.set(null, () => {
    const current = ROUTES.get(parent)!;
    const next = current.filter((child) => child !== route);
    if (next.length) ROUTES.set(parent, next);
    else ROUTES.delete(parent);

    REGISTERED.delete(route);
    refresh(parent);
  });
}

function refresh(route: Route) {
  if (SCHEDULED.has(route)) return;

  SCHEDULED.add(route);
  setTimeout(() => {
    SCHEDULED.delete(route);
    try {
      if (!route.get(null)) route.revision++;
      for (const child of ROUTES.get(route) || []) child.revision++;
      /* c8 ignore next 3 */
    } catch {
      // The refresh is intentionally deferred; the Route may have unmounted
      // before the microtask runs.
    }
  }, 0);
}
