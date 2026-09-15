import { listener } from '@expressive/mvc/observable';

import { Router } from './router';
import { assertAbsolute, canonicalize, normalize } from './url';

/** Binds the headless core to `window.location`, syncing `path`/`query` on navigation. */
export class BrowserRouter extends Router {
  static readonly global = Router.global;

  path = typeof window == 'undefined' ? '/' : window.location.pathname;

  goto(to: string, replace = false) {
    assertAbsolute(to);
    history[replace ? 'replaceState' : 'pushState'](null, '', normalize(to));
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

    const sync = () => {
      this.locate(window.location.pathname + window.location.search);
    };
    sync();
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

    // Direct `query` writes push to the browser's history; URL-driven changes
    // already match (compared canonically, so encoding differences don't dup).
    const release = listener(
      this.query,
      () => {
        const { url } = this;
        if (url !== canonicalize(window.location.pathname + window.location.search))
          history.pushState(null, '', url);
      },
      false
    );

    return () => {
      release();
      window.removeEventListener('popstate', sync);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }
}
