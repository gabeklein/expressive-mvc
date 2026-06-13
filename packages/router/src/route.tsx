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

  /**
   * Of the `as`-bearing child Routes competing for this scope's single slot,
   * decide whether `child` should cede it. Highest specificity wins (literal >
   * `:param` > catch-all); equal scores break by declaration order. `child`
   * yields unless it is that winner.
   *
   * Arbitration is the parent's call, not the child's, and purely lexical:
   * contenders and their scores are read from this Route's own children JSX
   * (their `to` props), so the field is whole before any child mounts - no
   * first-paint flicker, no walking live siblings. A Route whose pattern isn't
   * lexically visible (subclass class-field `to`, component-delegated matching)
   * doesn't contend, and a non-contending `child` is left to its own match
   * rather than suppressed.
   *
   * The verdict turns on `path`, which the child supplies from its own proxy
   * (so it re-arbitrates on navigation even when its `matched` is unchanged);
   * `contests` first gates that read to real rivalries, leaving a solitary
   * matched Route unsubscribed and free to reconcile in place.
   */
  contests(child: Route): boolean {
    // A fallback/redirect never competes on specificity (and a default's path
    // collides with a bare sibling's), so it's neither a rival nor arbitrated.
    if (child.default || child.redirect) return false;

    const rivals = contenders(this.props.children, scopeBase(this));
    return rivals.length > 1 && rivals.some((r) => r.path === child.path);
  }

  arbitrate(child: Route, path: string): boolean {
    let best: number | null = null;
    let winner: string | null = null;

    for (const rival of contenders(this.props.children, scopeBase(this))) {
      const found = rival.score(path);
      if (found !== null && (best === null || found > best)) {
        best = found;
        winner = rival.path;
      }
    }

    return winner !== child.path;
  }

  render(props = {} as { children?: Component.Node }) {
    const self = this.is;
    const { parent, as: Component, matched } = this;

    if (parent) {
      register(parent.is, self);

      // Defer the verdict to the parent, but read `path` here (our own proxy)
      // so a re-arbitration re-renders us; gated to real rivalries first.
      if (Component && parent.contests(self) && parent.arbitrate(self, this.router.path))
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
  return bestScore(children, base, path) !== null;
}

/** Highest specificity score among matching Routes lexically within `children`,
 * or null when none match. Same walk (and limits) as `matchesAnywhere`. */
function bestScore(children: Component.Node, base: string, path: string): number | null {
  let best: number | null = null;

  for (const node of childrenOf(children)) {
    if (!isElement(node)) continue;

    const type = typeOf(node);
    let found: number | null = null;

    if (type === Fragment)
      found = bestScore((propsOf(node) as RouteProps).children, base, path);
    else if (type === Route) {
      const props = propsOf(node) as RouteProps;
      if (props.redirect || props.default) continue;

      const to = typeof props.to === 'string' ? props.to : '';
      found = allRoutes(props.children)
        ? bestScore(props.children, base + patternSegment(to), path)
        : matchPattern(fullPattern(base, to), path)?.score ?? null;
    }

    if (found !== null && (best === null || found > best)) best = found;
  }

  return best;
}

type Contender = {
  /** Absolute path this Route claims - matched against a child's `path` to tie
   * the lexical verdict back to the rendering instance. */
  path: string;
  /** Specificity of its claim on a given path; null when it doesn't match. */
  score: (path: string) => number | null;
};

/**
 * The `as`-bearing Route nodes declared directly within `children` that vie for
 * a single slot, each paired with the path it claims and a path-scored lookup.
 * Recurses Fragments but stops at nested Route scopes - those arbitrate within
 * their own parent. Lexical only (reads `to` props), so subclass and
 * component-delegated Routes don't appear - mirroring `bestScore`.
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
    const score = allRoutes(props.children)
      ? (path: string) => bestScore(props.children, base + patternSegment(to), path)
      : (path: string) => matchPattern(fullPattern(base, to), path)?.score ?? null;

    out.push({ path: base + patternSegment(to), score });
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
