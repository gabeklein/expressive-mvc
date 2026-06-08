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

const PARAMS = new WeakMap<Route, Record<string, string> | undefined>();
const CHILDREN = new WeakMap<Route, Route[]>();

export class Route extends Component {
  router = set(() => this.get(Router, false) || new Router());

  as?: ComponentType<{ children?: ReactNode }> = undefined;

  to: string = '*';

  /**
   * Universal, consumer-agnostic display name for this Route, ignored by
   * matching. Plain text so *any* consumer can use it - NavLinks, breadcrumbs,
   * a document-title effect, `aria-label`. Visual extras live in `meta`.
   */
  label?: string = undefined;

  /**
   * Free-form metadata for this Route, ignored by matching. Surfaced to
   * NavLink components for the things `label` can't express - icon refs,
   * ordering hints, badges - without forcing a Route subclass.
   */
  meta?: Record<string, any> = undefined;

  /**
   * When matched, redirect here instead of rendering. Always replaces history
   * (a route that exists only to forward shouldn't leave a back-button trap);
   * for a non-replacing redirect, navigate yourself via `goto`/`Redirect`.
   */
  redirect?: string = undefined;

  /**
   * Match when nothing else in this Route's scope did - the `else` branch.
   * Has no path of its own; its blast radius is its parent (where it is nested
   * defines its scope), so a root-level fallback is the app 404 and a nested
   * one is the section 404.
   */
  fallback = false;

  /** Nearest mounted Route ancestor, if any. */
  parent = get(Route, false);

  /** Registered child Routes, in declaration order. Reactive. */
  inner: Route[] = [];

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
      if (keys.length === Object.keys(prev!).length && keys.every(k => prev![k] === next[k]))
        return prev;
    }

    PARAMS.set(this, next);
    return next;
  }

  /**
   * Boolean derivative of `match`. Reading this in render (instead of `match`)
   * lets same-pattern navigations skip Route re-renders: the boolean stays
   * `true` across `/posts/foo` -> `/posts/bar`, so Expressive's memoized
   * computed property fires no event and the page Component reconciles in
   * place with its Consumer picking up new params reactively.
   */
  get matched(): boolean {
    const { parent } = this;

    if (this.fallback)
      return parent ? parent.matched && !parent.matches.length : false;

    return !!this.match;
  }

  /** This Route's own absolute path (base joined with its segment). */
  get path(): string {
    return this.fallback ? this.base : this.base + this.router.segment(this.to);
  }

  /**
   * A no-`as`, no-`to` Route: a transparent grouping node. Contributes no path
   * segment and is not itself a match candidate, but stays in the tree (`inner`)
   * so NavLinks can render it as a group. Matching sees *through* it to its
   * children, which compose against the nearest real ancestor's base.
   *
   * The `'to' in props` check is provisional: it exists only because the
   * default `to` is `'*'`, so "no `to`" can't be read off the resolved value.
   * Once the default flips to `''` (see PLAN Phase 5) this becomes the clean
   * structural `!this.as && !this.to`, with no props introspection.
   */
  get group(): boolean {
    return !this.as && !('to' in this.props);
  }

  /**
   * The matched child Route: `undefined` if none match, `null` if more than
   * one does (ambiguous, non-discriminated). Redirect/fallback routes are not
   * candidates; anonymous groups are seen through to their children.
   */
  get active(): Route | undefined | null {
    const { match } = this.router;
    let found: Route | undefined;

    const scan = (routes: Route[]): boolean => {
      for (const route of routes) {
        if (route.redirect || route.fallback) continue;
        if (route.group) {
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
   * Paths of all currently-matched child routes, in declaration order.
   * Redirect/fallback excluded; anonymous groups seen through to their children.
   * A flat projection (no live Route refs), so it is safe to read reactively.
   */
  get matches(): string[] {
    const { match } = this.router;
    const collect = (routes: Route[]): string[] =>
      routes.flatMap((route) =>
        route.redirect || route.fallback ? []
        : route.group ? collect(route.inner)
        : match(route.base, route.to) ? [route.path] : []
      );

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

    if (allRoutes(children)) {
      if (!Component) return <>{children}</>;
      return matched ? <Component>{children}</Component> : null;
    }

    if (!matched) return null;
    return Component ? <Component>{children}</Component> : children;
  }
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
