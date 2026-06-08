import { Component, get, use } from '@expressive/react';
import { ComponentType, Fragment, ReactNode } from 'react';

import { Link } from './link';
import { Route } from './route';

export class NavLinks extends Component {
  route = get(Route);

  List(props: { children?: ReactNode }): ReactNode {
    return <ul>{props.children}</ul>;
  }

  Item(props: { route: Route; active: boolean; label?: string; meta: Route['meta'] }): ReactNode {
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
  Group(props: { route: Route; children?: ReactNode }): ReactNode {
    return props.children;
  }

  render() {
    return this.branch(this.route.inner);
  }

  branch(routes: Route[]): ReactNode {
    const { Item, List, Group } = this;

    return (
      <List>
        {routes.map((route, i) => {
          if (route.redirect || route.fallback) return null;

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

type ItemType = ComponentType<{ route: Route; active: boolean; label?: string; meta: Route['meta'] }>;

function Entry(props: { route: Route; Item: ItemType; children?: ReactNode }) {
  const route = use(props.route);

  return (
    <Fragment>
      <props.Item route={route} active={route.matched} label={route.label} meta={route.meta} />
      {props.children}
    </Fragment>
  )
}
