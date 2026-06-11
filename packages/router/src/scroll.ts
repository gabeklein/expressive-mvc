import { Component, get } from '@expressive/react';

import { Router } from './router';

const STORAGE = 'expressive-router:scroll';

/**
 * Scrolls to top on push navigations and restores the saved position on
 * back/forward. Positions are kept in sessionStorage keyed by pathname -
 * BrowserRouter delegates the stack to `window.history`, so no per-entry key
 * is available and distinct history entries sharing a path share a slot.
 */
export class ScrollRestoration extends Component {
  router = get(Router);

  protected new() {
    const positions = saved();
    let pop = false;
    let from = this.router.path;

    const onPop = () => pop = true;
    window.addEventListener('popstate', onPop);

    const done = this.get(({ router }) => {
      const { path } = router;
      if (path === from) return;

      positions[from] = window.scrollY;
      sessionStorage.setItem(STORAGE, JSON.stringify(positions));
      from = path;

      window.scrollTo(0, pop ? positions[path] || 0 : 0);
      pop = false;
    });

    return () => {
      window.removeEventListener('popstate', onPop);
      done();
    };
  }

  render() {
    return null;
  }
}

function saved(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE) || '{}');
  } catch {
    return {};
  }
}
