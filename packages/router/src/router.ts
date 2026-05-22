import { Component } from '@expressive/react';
import { Children, ReactElement, ReactNode, isValidElement } from 'react';

import { Route } from './route';

export interface Match {
  params: Record<string, string>;
}

export class Router extends Component {
  path = window.location.pathname;

  protected new() {
    const sync = () => {
      this.path = window.location.pathname;
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }

  goto(to: string, replace = false) {
    if (!to.startsWith('/'))
      throw new Error(
        `Router.goto requires an absolute path; got "${to}". Relative paths must be resolved via a Route (e.g. Route.get().goto).`
      );
    const url = new URL(to, window.location.origin);
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    this.path = url.pathname;
  }

  render(props: { children?: ReactNode } = {}) {
    for (const child of Children.toArray(props.children)) {
      if (!isRouteElement(child)) continue;
      if (matchPattern(child.props.to ?? '', this.path)) return child;
    }
    return null;
  }
}

export function matchPattern(pattern: string, path: string): Match | null {
  const patternParts = split(pattern);
  const pathParts = split(path);

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const v = pathParts[i];
    if (p.startsWith(':')) params[p.slice(1)] = v;
    else if (p.toLowerCase() !== v.toLowerCase()) return null;
  }

  return { params };
}

function isRouteElement(child: unknown): child is ReactElement<{ to?: string }> {
  return isValidElement(child) && child.type === Route;
}

function split(path: string) {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? [] : trimmed.split('/');
}
