import { Component, get } from '@expressive/mvc';
import type { JSX } from '@expressive/mvc/jsx-runtime';

import { Route } from './route';

/** Host anchor attributes when the adapter declares intrinsics; `{}` agnostically. */
type AnchorProps = JSX.IntrinsicElements extends { a: infer T } ? T : {};

/** What `go` reads off a click - structural, no host event type needed. */
interface ClickEvent {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault(): void;
}

export namespace Link {
  export type Props = AnchorProps & {
    to?: string;
    replace?: boolean;
    children?: Component.Node;
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

  private go = (e: ClickEvent) => {
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
