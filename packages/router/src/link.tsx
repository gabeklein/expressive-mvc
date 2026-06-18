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
  fallback = false;

  protected route = get(Route);

  /** Absolute resolved path for the rendered `<a href>`. */
  get href(): string {
    return this.route.resolve(this.to);
  }

  /** How the current path relates to this link's target:
   * `true` exact match, `false` prefix match, `undefined` no match.
   * Reading this (or `active`) in render subscribes to navigation;
   * a Link that reads neither stays inert across navigation. */
  get match(): boolean | undefined {
    const { href } = this;
    const { path } = this.route.router;

    if (path === href) return true;
    if (path.startsWith(href === '/' ? href : href + '/')) return false;
  }

  /** Whether the current path matches this link's target at all. */
  get active(): boolean {
    return this.match !== undefined;
  }

  protected go = (e: ClickEvent) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    this.route.goto(this.to, this.replace);
  };

  /**
   * If a subclass authores own render, it will override default anchor wrapping.
   */
  render({ children, to, replace, ...rest } = {} as Link.Props) {
    if (children !== this.props.children) return children;

    return (
      <a {...rest} href={this.href} onClick={this.go}>
        {children}
      </a>
    );
  }
}
