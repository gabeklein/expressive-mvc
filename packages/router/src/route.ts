import { Component, get } from '@expressive/react';
import { ComponentType, ReactNode, createElement } from 'react';

import { matchPattern, Match } from './matcher';
import { Router } from './router';

export class Route extends Component {
  to = '';
  as: ComponentType<{ children?: ReactNode }> = passthrough;
  fresh = false;

  router = get(Router);

  get match(): Match | null {
    return matchPattern(this.to, this.router.path);
  }

  // Route only mounts when matched, so match is guaranteed non-null here.
  get params(): Record<string, string> {
    return this.match!.params;
  }

  render(props: { children?: ReactNode } = {}) {
    return createElement(
      this.as,
      this.fresh ? { key: this.router.path } : undefined,
      props.children
    );
  }
}

function passthrough(props: { children?: ReactNode }) {
  return props.children === undefined ? null : props.children;
}
