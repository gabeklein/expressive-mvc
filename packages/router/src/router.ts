import { Component } from '@expressive/react';
import { Children, ReactElement, ReactNode, isValidElement } from 'react';

import { matchPattern } from './matcher';
import { Route } from './route';

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
    const url = new URL(to, window.location.origin);
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    this.path = url.pathname;
  }

  render(props: { children?: ReactNode } = {}) {
    return resolve(props.children, this.path);
  }
}

export function resolve(children: ReactNode, path: string): ReactNode {
  for (const child of Children.toArray(children)) {
    if (!isRouteElement(child)) continue;
    if (matchPattern(child.props.to ?? '', path)) return child;
  }
  return null;
}

function isRouteElement(node: unknown): node is ReactElement<{ to?: string }> {
  return isValidElement(node) && node.type === Route;
}
