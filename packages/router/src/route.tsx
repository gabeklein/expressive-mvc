import { Component, get, set } from '@expressive/mvc';
import { childrenOf, Fragment, isElement, propsOf, typeOf } from '@expressive/mvc/jsx-runtime';

import { Redirect } from './redirect';
import { Router } from './router';
import { fullPattern, matchPattern, patternSegment } from './url';

const PARAMS = new WeakMap<Route, Record<string, string> | undefined>();
const CHILDREN = new WeakMap<Route, Route[]>();

export class Route extends Component {
  router = set(() => this.get(Router, false) || new Router());

  as?: (props: { children?: Component.Node }) => Component.Node = undefined;

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
    // Key by the real instance - this getter runs under observer proxies too,
    // and per-proxy entries would break identity stability across contexts.
    const self = this.is;
    const next = this.router.match(this.base, this.to)?.params;
    const has = PARAMS.has(self);
    const prev = PARAMS.get(self);

    if (has && !next === !prev) {
      if (!next) return prev;
      const keys = Object.keys(next);
      if (keys.length === Object.keys(prev!).length && keys.every(k => prev![k] === next[k]))
        return prev;
    }

    PARAMS.set(self, next);
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

  /**
   * Live query record from the active Router. Global (not route-scoped) - every
   * Route sees the same params, unlike `match` which is this Route's captures.
   * Narrow known keys in a subclass via `declare`, same as on Router:
   *
   * ```ts
   * class Search extends Route {
   *   declare query: { q?: string; page?: string };
   * }
   * ```
   */
  query = set(() => this.router.query);

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

  render(props = {} as { children?: Component.Node }) {
    const self = this.is;
    const { parent, as: Component, matched } = this;

    if (parent) {
      register(parent.is, self);

      // `path` read via our own proxy so re-arbitration re-renders us.
      if (Component && cedes(parent, self, () => this.router.path))
        return null;
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
function hasDefault(children: Component.Node): boolean {
  return childrenOf(children).some(
    (node) => isElement(node) && typeOf(node) === Route && (propsOf(node) as RouteProps).default
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
  as?: unknown;
  redirect?: string;
  default?: boolean;
  children?: Component.Node;
};

/**
 * Does any Route within `children` match `path` (composed against `base`)? A
 * synchronous, lexical walk of the JSX - the see-through opt-out gate. Strict:
 * a scope counts only when a descendant matches, never as a greedy prefix.
 * Blind to class-field `to` (subclasses) and component-internal routes (the
 * `*`-delegation case) - the documented limits of the lexical model.
 */
export function matchesAnywhere(children: Component.Node, base: string, path: string): boolean {
  for (const node of childrenOf(children)) {
    if (!isElement(node)) continue;

    const type = typeOf(node);

    if (type === Fragment) {
      if (matchesAnywhere((propsOf(node) as RouteProps).children, base, path)) return true;
      continue;
    }

    if (type !== Route) continue;

    const props = propsOf(node) as RouteProps;
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

type Contender = {
  /** Absolute path this Route claims. */
  path: string;
  /** Whether it claims (matches) a given path. */
  matches: (path: string) => boolean;
};

/**
 * Whether `child` should cede `parent`'s single `as`-slot to an earlier rival.
 * First contender (declaration order) matching the path wins. `path` is a thunk,
 * read only once a real rivalry exists, so a solitary match stays unsubscribed.
 */
function cedes(parent: Route, child: Route, path: () => string): boolean {
  // Fallback/redirect never competes by order, so it's never arbitrated.
  if (child.default || child.redirect) return false;

  const rivals = contenders(parent.props.children, scopeBase(parent));
  if (rivals.length < 2 || !rivals.some((r) => r.path === child.path)) return false;

  const at = path();
  for (const rival of rivals)
    if (rival.matches(at))
      return rival.path !== child.path;

  return true;
}

/**
 * The `as`-bearing Route nodes declared directly within `children`, in
 * declaration order, each paired with its claimed path and a match test.
 * Recurses Fragments, stops at nested Route scopes. Lexical only (reads `to`).
 */
function contenders(children: Component.Node, base: string): Contender[] {
  const out: Contender[] = [];

  for (const node of childrenOf(children)) {
    if (!isElement(node)) continue;

    const type = typeOf(node);

    if (type === Fragment) {
      out.push(...contenders((propsOf(node) as RouteProps).children, base));
      continue;
    }

    if (type !== Route) continue;

    const props = propsOf(node) as RouteProps;
    if (!props.as || props.redirect || props.default) continue;

    const to = typeof props.to === 'string' ? props.to : '';
    const matches = allRoutes(props.children)
      ? (path: string) => matchesAnywhere(props.children, base + patternSegment(to), path)
      : (path: string) => matchPattern(fullPattern(base, to), path) !== null;

    out.push({ path: base + patternSegment(to), matches });
  }

  return out;
}

function allRoutes(children: Component.Node): boolean {
  const nodes = childrenOf(children);

  return nodes.length > 0 && nodes.every((node) => {
    if (!isElement(node)) return false;
    const type = typeOf(node);
    if (type === Fragment)
      return allRoutes((propsOf(node) as RouteProps).children);
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
