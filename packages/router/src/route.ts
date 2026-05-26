import { Component, get, set } from '@expressive/react';
import { ComponentType, ReactNode, createElement } from 'react';

import { Router } from './router';

const PARAMS = new WeakMap<Route, Record<string, string> | undefined>();
const CHILDREN = new WeakMap<Route, Route[]>();

export class Route extends Component {
  router = set(() => this.get(Router, false) || new Router());

  as?: ComponentType<{ children?: ReactNode }> = undefined;

  to: string = '*';

  /** Nearest mounted Route ancestor, if any. */
  parent = get(Route, false);

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
    return !!this.match;
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
    const self = this.is;
    const { parent, as, matched } = this;

    if (parent) {
      register(parent.is, self);

      if (as)
        for (const sibling of CHILDREN.get(parent.is)!) {
          if (sibling === self) break;
          if (sibling.as && sibling.matched) return null;
        }
    }

    if (!matched) return null;
    return as ? createElement(as, {}, children) : children;
  }
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

  child.set(null, () => {
    const i = list!.indexOf(child);
    if (i >= 0) list!.splice(i, 1);
    if (!list!.length) CHILDREN.delete(parent);
  });
}
