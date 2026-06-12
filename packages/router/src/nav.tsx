import { Component, get } from '@expressive/mvc';

import { Link } from './link';
import { Route } from './route';

export class NavLinks extends Component {
  route = get(Route);

  List(props: { children?: Component.Node }): Component.Node {
    return <ul>{props.children}</ul>;
  }

  Item(props: { route: Route; active: boolean; label?: string; meta: Route['meta'] }): Component.Node {
    const { route, active, label } = props;
    return (
      <Link to={route.path} aria-current={active ? 'page' : undefined}>
        {label ?? route.path}
      </Link>
    );
  }

  /**
   * Renders an anonymous (group) node. Default is transparent - flattens by
   * passing children through. Override to wrap a group in a heading/section
   * (the node's `label`/`meta` describe it), turning tree structure into nav
   * sections with no explicit navigation layer.
   */
  Group(props: { route: Route; children?: Component.Node }): Component.Node {
    return props.children;
  }

  render() {
    return this.branch(this.route.inner);
  }

  branch(routes: Route[]): Component.Node {
    const { Item, List, Group } = this;

    return (
      <List>
        {routes.map((route, i) => {
          if (route.redirect || route.default) return null;

          const inner = route.inner.length ? this.branch(route.inner) : null;

          return route.as || !inner ? (
            <Entry key={i} route={route} Item={Item}>
              {inner}
            </Entry>
          ) : (
            <Group key={i} route={route}>{inner}</Group>
          );
        })}
      </List>
    );
  }
}

type ItemType = (props: { route: Route; active: boolean; label?: string; meta: Route['meta'] }) => Component.Node;

/**
 * Per-item reactive wrapper. `route` arrives as a prop and becomes a managed
 * property, so reads in render (`route.matched`) wire cross-state
 * subscriptions - same idiom as `Route.router`, no host hook involved.
 */
class Entry extends Component {
  route?: Route = undefined;
  Item?: ItemType = undefined;

  /** Entry never suspends itself; no boundary here - a suspending custom
   * `Item` bubbles to NavLinks (or above) rather than blanking one row. */
  fallback = false;

  render(props = {} as { children?: Component.Node }) {
    const { route, Item } = this;

    if (!route || !Item) return null;

    return (
      <>
        <Item route={route} active={route.matched} label={route.label} meta={route.meta} />
        {props.children}
      </>
    );
  }
}
