import { Component, get } from '@expressive/react';
import { AnchorHTMLAttributes, MouseEvent } from 'react';

import { Route } from './route';

export namespace Link {
  export type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
    to?: string;
    replace?: boolean;
  };
}

export class Link extends Component {
  to = '';
  replace = false;

  private route = get(Route);

  /** Absolute resolved path for the rendered `<a href>`. */
  get href(): string {
    return this.route.resolve(this.to);
  }

  private go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    this.route.goto(this.to, this.replace);
  };

  render({ children, to, replace, ...rest } = {} as Link.Props) {
    return (
      <a {...rest} href={this.href} onClick={this.go}>
        {children}
      </a>
    );
  }
}
