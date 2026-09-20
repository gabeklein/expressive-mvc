import { bindQuery, navigate, Router } from './router';

const SELF_DRIVEN = new WeakSet<object>();

/** Binds the headless core to `window.location`, syncing `path`/`query` on navigation. */
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

  // The browser owns the history stack; back/forward delegate to it (popstate
  // syncs path/query), so the inherited in-memory entries/index go unused here.
  back() {
    history.back();
  }

  forward() {
    history.forward();
  }

  protected new() {
    if (typeof window == 'undefined') return () => {};

    bindQuery(this);
    this.locate(window.location.pathname + window.location.search);

    const sync = () => {
      if (SELF_DRIVEN.has(this)) return;

      navigate(
        this,
        (work) => this.navigate(work),
        () => this.locate(window.location.pathname + window.location.search)
      );
    };
    window.addEventListener('popstate', sync);

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
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }
}
