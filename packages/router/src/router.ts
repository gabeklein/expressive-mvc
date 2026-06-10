import { Component } from '@expressive/react';
import {
  ReactNode,
  TransitionStartFunction,
  startTransition,
  useEffect,
  useTransition
} from 'react';

import { Route } from './route';
import { Match, fullPattern, matchPattern, patternSegment } from './url';

/** Per-instance hook-resident `startTransition` (from `useTransition`), captured
 * in render so `transition` - which runs outside render - can drive `pending`. */
const TRANSITION = new WeakMap<object, TransitionStartFunction>();

/**
 * Headless router core: matching plus an in-memory `path` and history stack.
 * Touches no browser globals, so it runs (and tests) under any host - it is
 * also the memory-router substrate. `BrowserRouter` binds this to
 * `window.location`/`history`; the public API stays string-based at the edges
 * either way.
 */
export class Router extends Component {
  path = '/';

  /** True while a deferred navigation is in flight - mirror to `aria-busy`, a
   * progress bar, or a dimming overlay. Only the React-bound `BrowserRouter`
   * drives it (via `useTransition`); on the headless base it stays `false`. */
  pending = false;

  /** In-memory history: visited paths and the cursor into them. */
  entries: string[] = [];
  index = 0;

  protected new() {
    this.entries = [this.path];
  }

  /**
   * Returns a function that tests a (base, to) pair against the current path.
   *
   * Exposed as a getter so consumers track `path` reactively: reading
   * `router.match(...)` establishes a dependency on the current path via this
   * getter, which is what reactive consumers (Routes, resolvers) rely on.
   */
  get match(): (base: string, to: string) => Match | null {
    const { path } = this;
    return (base, to) => matchPattern(fullPattern(base, to), path);
  }

  goto(to: string, replace = false) {
    assertAbsolute(to);
    const path = normalize(to);

    this.transition(() => {
      if (replace)
        this.entries[this.index] = path;
      else {
        this.entries = [...this.entries.slice(0, this.index + 1), path];
        this.index = this.entries.length - 1;
      }

      // cast resolves `set`'s `Assign<this>` under polymorphic `this`
      (this as Router).set({ path }, true);
    });
  }

  back() {
    if (this.index <= 0) return;
    this.transition(() => {
      (this as Router).set({ path: this.entries[--this.index] }, true);
    });
  }

  forward() {
    if (this.index >= this.entries.length - 1) return;
    this.transition(() => {
      (this as Router).set({ path: this.entries[++this.index] }, true);
    });
  }

  /**
   * Brackets a navigation. `commit` applies the path change **silently** (no
   * notify); then `set("path")` emits explicitly so subscribers (Routes) wake
   * **synchronously, in scope**. Splitting silent-update from explicit-emit is
   * what lets a subclass run the emit *inside* `startTransition` so React
   * captures the re-render as transition work (deferred presentation).
   *
   * The base is synchronous - no deferral. `BrowserRouter` overrides to wrap
   * `commit` in `startTransition`, holding the current screen until the next
   * page resolves.
   */
  protected transition(commit: () => void) {
    const before = this.path;
    commit();
    if (this.path !== before) this.set('path');
  }

  segment(to: string): string {
    return patternSegment(to);
  }

  /**
   * Directory-style anchor for relative navigation from a Route. Strips trailing
   * `/*` (catch-all, which belongs to children) and substitutes `:params`.
   * Always ends with `/`.
   */
  anchor(route: Route): string {
    const own = route.to
      .replace(/\/?\*$/, '')
      .replace(/:(\w+)/g, (_, name) => route.match![name]);

    return own.endsWith('/') ? own : own + '/';
  }

  /** Resolve a (possibly relative) url against a Route's anchor; returns absolute pathname. */
  resolve(route: Route, url: string): string {
    if (url.startsWith('/')) return url;
    return new URL(url, 'x://_' + this.anchor(route)).pathname;
  }
}

/** Binds the headless core to `window.location`, syncing `path` on navigation. */
export class BrowserRouter extends Router {
  path = window.location.pathname;

  goto(to: string, replace = false) {
    assertAbsolute(to);
    history[replace ? 'replaceState' : 'pushState'](null, '', normalize(to));
  }

  // The browser owns the history stack; back/forward delegate to it (popstate
  // syncs `path`), so the inherited in-memory entries/index go unused here.
  back() {
    history.back();
  }

  forward() {
    history.forward();
  }

  /**
   * Deferred presentation: hold the current screen until the navigated page
   * resolves. Wrapping the base seam in `startTransition` captures the
   * re-render *because* the base emits `path` synchronously inside this
   * callback (a batched notify would escape and no-op the deferral).
   *
   * Prefers the hook-resident `startTransition` (so `pending` reflects the
   * transition), falling back to the standalone one before first render.
   */
  protected transition(commit: () => void) {
    (TRANSITION.get(this.is) || startTransition)(() => super.transition(commit));
  }

  /**
   * Runs `useTransition` in render (the only place a hook may live): captures
   * its `startTransition` for `transition`, and feeds `pending` to the field
   * from an effect (assigning in render would update subscribers mid-render).
   */
  render(props = {} as { children?: ReactNode }) {
    const [pending, start] = useTransition();

    TRANSITION.set(this.is, start);
    useEffect(() => {
      this.pending = pending;
    }, [pending]);

    return props.children ?? null;
  }

  protected new() {
    // The single location -> path mirror point; routes through `transition`,
    // so every browser navigation (goto/back/forward/popstate/external) defers.
    const sync = () => this.transition(() => {
      (this as Router).set({ path: window.location.pathname }, true);
    });
    window.addEventListener('popstate', sync);

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args) => { origPush(...args); sync(); };
    history.replaceState = (...args) => { origReplace(...args); sync(); };

    return () => {
      window.removeEventListener('popstate', sync);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }
}

function assertAbsolute(to: string) {
  if (!to.startsWith('/'))
    throw new Error(
      `Router.goto requires an absolute path; got "${to}". Relative paths must be resolved via a Route (e.g. Route.get().goto).`
    );
}

/** Collapse `.`/`..` and stray slashes without touching browser globals. */
function normalize(to: string): string {
  return new URL(to, 'x://_').pathname;
}
