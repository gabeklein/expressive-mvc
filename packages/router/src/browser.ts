import { bindLocation, deltaOf, navigate, Router } from './router';

const SELF_DRIVEN = new WeakSet<object>();

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

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args) => {
      origPush(...args);
      sync();
    };
    history.replaceState = (...args) => {
      origReplace(...args);
      sync();
    };

    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }
}

function current() {
  return window.location.pathname + window.location.search + window.location.hash;
}
