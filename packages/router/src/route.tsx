import { Component, get, set } from '@expressive/react';
import {
  Children,
  ComponentType,
  Fragment,
  ReactNode,
  isValidElement
} from 'react';

import { Redirect } from './redirect';
import { Router } from './router';
import { fullPattern, matchPattern, patternSegment } from './url';

const PARAMS = new WeakMap<Route, Record<string, string> | undefined>();
const CHILDREN = new WeakMap<Route, Route[]>();

export class Route extends Component {
  router = set(() => this.get(Router, false) || new Router());

  as?: ComponentType<{ children?: ReactNode }> = undefined;

  to: string = '';

  /** Consumer-agnostic display name (ignored by matching) - for NavLinks,
   * breadcrumbs, titles. Non-text extras live in `meta`. */
  label?: string = undefined;

  /** Free-form metadata (ignored by matching) for what `label` can't express -
   * icons, ordering, badges - without a Route subclass. */
  meta?: Record<string, any> = undefined;

  /** When matched, redirect here instead of rendering. Always replaces history. */
  redirect?: string = undefined;

  /** Matches when nothing else in this scope did. Scoped to its parent: a
   * root-level default is the app 404, a nested one the section 404. */
  default = false;

  /** Nearest mounted Route ancestor, if any. */
  parent = get(Route, false);

  /** Registered child Routes, in declaration order. Reactive. */
  inner: Route[] = [];

  /** Base path inherited from parent Route (empty at the root). */
  get base(): string {
    const { parent } = this;
    return parent ? parent.base + this.router.segment(parent.to) : '';
  }

  /** Captured params from the current match, or `undefined` when unmatched.
   * Stable identity across reads when captures are unchanged. */
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

  /**
   * Boolean derivative of `match`, read in render instead of `match` so
   * same-pattern navigations (`/posts/foo` -> `/posts/bar`) don't re-render the
   * Route - the boolean is unchanged, so the page reconciles in place.
   */
  get matched(): boolean {
    const { parent } = this;

    if (this.default)
      return parent ? parent.matched && !parent.matches.length : false;

    if (isRoot(this)) return true;
    if (hasRoutes(this)) return scopeResolves(this, this.router.path);

    return !!this.match;
  }

  /** This Route's own absolute path (base joined with its segment). */
  get path(): string {
    return this.default ? this.base : this.base + this.router.segment(this.to);
  }

  /**
   * The matched child Route: `undefined` if none, `null` if ambiguous (>1).
   * Redirect/default excluded; see-through scopes seen through to children.
   */
  get active(): Route | undefined | null {
    const { match } = this.router;
    let found: Route | undefined;

    const scan = (routes: Route[]): boolean => {
      for (const route of routes) {
        if (route.redirect || route.default) continue;
        if (hasRoutes(route)) {
          if (scan(route.inner)) return true;
          continue;
        }
        if (!match(route.base, route.to)) continue;
        if (found) return true;
        found = route;
      }
      return false;
    };

    return scan(this.inner) ? null : found;
  }

  /**
   * Paths of currently-matched child routes, declaration order. A flat
   * projection (no live Route refs), safe to read reactively.
   */
  get matches(): string[] {
    const { match, path } = this.router;
    const collect = (routes: Route[]): string[] =>
      routes.flatMap((route) => {
        if (route.redirect || route.default) return [];
        if (!hasRoutes(route))
          return match(route.base, route.to) ? [route.path] : [];

        // A scope counts via a matched descendant, or its own section default.
        const deep = collect(route.inner);
        return deep.length ? deep
          : defaultCatches(route, path) ? [route.path] : [];
      });

    return collect(this.inner);
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

  render(props = {} as { children?: ReactNode }) {
    const self = this.is;
    const { parent, as: Component, matched } = this;

    if (parent) {
      register(parent.is, self);

      if (Component)
        for (const sibling of CHILDREN.get(parent.is)!) {
          if (sibling === self) break;
          if (sibling.as && sibling.matched) return null;
        }
    }

    if (this.redirect)
      return matched
        ? <Redirect to={this.redirect} replace />
        : null;

    if (Object.getOwnPropertyDescriptor(props, 'children')?.get)
      return matched ? props.children : null;

    const { children } = props;

    // Matched: render content (in `as` chrome if present). Unmatched: a
    // see-through scope still mounts children (registration); a leaf renders null.
    if (matched)
      return Component ? <Component>{children}</Component> : <>{children}</>;

    return allRoutes(children) ? <>{children}</> : null;
  }
}

/** Does `children` hold a direct default Route? Such a scope resolves to it. */
function hasDefault(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (node) => isValidElement(node) && node.type === Route && (node.props as RouteProps).default
  );
}

/** Is `path` inside `base`'s subtree? The root base ('') contains everything. */
function within(base: string, path: string): boolean {
  return !base || path === base || path.startsWith(base + '/');
}

/**
 * A parent-less Route with no `to` prop is its own root - always matched,
 * capturing everything below. (Explicit `to=""` at root stays an index.)
 */
function isRoot(route: Route): boolean {
  return !route.parent && !!route.props && !('to' in route.props);
}

/** The base a scope's children compose against (own base + segment). */
function scopeBase(route: Route): string {
  return route.base + route.router.segment(route.to);
}

/** Lexical (gate-form): scope resolves via a descendant match or its own
 * section default within base - used by `matched`, before children register. */
function scopeResolves(route: Route, path: string): boolean {
  const base = scopeBase(route);
  return matchesAnywhere(route.props.children, base, path)
    || (hasDefault(route.props.children) && within(base, path));
}

/** Registration-form: scope owns a default catching the path within base -
 * used by `matches` so a section 404 suppresses an ancestor 404. */
function defaultCatches(route: Route, path: string): boolean {
  return route.inner.some((c) => c.default) && within(scopeBase(route), path);
}

/** Has lexical child Routes - i.e. a see-through scope (vs. a leaf). */
function hasRoutes(route: Route): boolean {
  return allRoutes(route.props.children);
}

type RouteProps = {
  to?: string;
  redirect?: string;
  default?: boolean;
  children?: ReactNode;
};

/**
 * Does any Route within `children` match `path` (composed against `base`)? A
 * synchronous, lexical walk of the JSX - the see-through opt-out gate. Strict:
 * a scope counts only when a descendant matches, never as a greedy prefix.
 * Blind to class-field `to` (subclasses) and component-internal routes (the
 * `*`-delegation case) - the documented limits of the lexical model.
 */
export function matchesAnywhere(children: ReactNode, base: string, path: string): boolean {
  for (const node of Children.toArray(children)) {
    if (!isValidElement(node)) continue;

    const { type } = node;

    if (type === Fragment) {
      if (matchesAnywhere((node.props as RouteProps).children, base, path)) return true;
      continue;
    }

    if (type !== Route) continue;

    const props = node.props as RouteProps;
    if (props.redirect || props.default) continue;

    const to = typeof props.to === 'string' ? props.to : '';

    if (allRoutes(props.children)) {
      if (matchesAnywhere(props.children, base + patternSegment(to), path)) return true;
      continue;
    }

    if (matchPattern(fullPattern(base, to), path)) return true;
  }

  return false;
}

function allRoutes(children: ReactNode): boolean {
  const nodes = Children.toArray(children);

  return nodes.length > 0 && nodes.every((node) => {
    if (!isValidElement(node)) return false;
    const { type } = node;
    if (type === Fragment)
      return allRoutes((node.props as { children?: ReactNode }).children);
    return type === Route || (typeof type === 'function' && type.prototype instanceof Route);
  });
}

function register(parent: Route, child: Route) {
  let list = CHILDREN.get(parent);

  if (list) {
    if (list.includes(child)) return;
  } else {
    list = [];
    CHILDREN.set(parent, list);
  }

  list.push(child);
  parent.inner = list.slice();

  child.set(null, () => {
    const i = list!.indexOf(child);
    if (i >= 0) list!.splice(i, 1);
    if (!list!.length) CHILDREN.delete(parent);
    if (!parent.get(null)) parent.inner = list!.slice();
  });
}
