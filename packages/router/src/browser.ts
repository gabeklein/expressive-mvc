import { bindLocation, deltaOf, navigate, Router } from './router';

const SELF_DRIVEN = new WeakSet<object>();
const LISTENERS = new Set<() => void>();

let restore: (() => void) | undefined;

/** Binds the headless core to `window.location` and browser history. */
export class BrowserRouter extends Router {
  static readonly global = Router.global;

  path = typeof window == 'undefined' ? '/' : window.location.pathname;

  protected async next(url: string, replace?: boolean) {
    await navigate(
      this,
      (work) => this.navigate(work),
      () => this.locate(url),
      () => {
        SELF_DRIVEN.add(this);

        try {
          history[replace ? 'replaceState' : 'pushState'](null, '', url);
        } finally {
          SELF_DRIVEN.delete(this);
        }
      }
    );
  }

  // The browser owns the history stack; popstate synchronizes its location.
  go(delta: number) {
    delta = deltaOf(delta);
    if (delta) history.go(delta);
  }

  protected new() {
    if (typeof window == 'undefined') return () => {};

    this.locate(current());
    bindLocation(this);

    const sync = () => {
      if (SELF_DRIVEN.has(this)) return;

      navigate(
        this,
        (work) => this.navigate(work),
        () => this.locate(current())
      );
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);

    const unpatch = patch(sync);

    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      unpatch();
    };
  }
}

function patch(sync: () => void) {
  LISTENERS.add(sync);

  if (!restore) {
    const { pushState, replaceState } = history;
    const notify = () => LISTENERS.forEach((sync) => sync());

    history.pushState = function (...args) {
      pushState.apply(this, args);
      notify();
    };
    history.replaceState = function (...args) {
      replaceState.apply(this, args);
      notify();
    };

    restore = () => {
      history.pushState = pushState;
      history.replaceState = replaceState;
      restore = undefined;
    };
  }

  return () => {
    LISTENERS.delete(sync);
    if (!LISTENERS.size) restore?.();
  };
}

function current() {
  return window.location.pathname + window.location.search + window.location.hash;
}
