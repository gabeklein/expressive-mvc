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

  protected route = get(Route);

  /** Absolute resolved path for the rendered `<a href>`. */
  get href(): string {
    return this.route.resolve(this.to);
  }

  protected go = (e: ClickEvent) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    this.route.goto(this.to, this.replace);
  };

  render({ children, to, replace, ...rest } = {} as Link.Props) {
    return (
      <a {...this.attributes(rest)} href={this.href} onClick={this.go}>
        {children}
      </a>
    );
  }

  /** Maps remaining props to anchor attributes; subclasses may decorate.
   * A getter (not a method) so overrides stay reactive - state read while
   * computing it is tracked by render. */
  protected get attributes() {
    return (rest: AnchorProps) => rest;
  }
}

export namespace NavLink {
  export type Props = Link.Props & {
    exact?: boolean;
    activeClassName?: string;
  };
}

export class NavLink extends Link {
  /** Match only when the path equals `href` exactly; default is prefix match. */
  exact = false;

  activeClassName = 'active';

  get active(): boolean {
    const { href } = this;
    const { path } = this.route.router;

    if (path === href) return true;
    return !this.exact && path.startsWith(href === '/' ? href : href + '/');
  }

  protected get attributes() {
    const { active, activeClassName } = this;

    return (rest: AnchorProps) => {
      const { exact, activeClassName: _, className, ...attrs } =
        rest as NavLink.Props;

      return {
        ...attrs,
        className: !active ? className
          : className ? `${className} ${activeClassName}`
          : activeClassName,
        'aria-current': active ? 'page' as const : undefined
      };
    };
  }
}
