import { Component, get, use } from '@expressive/react';
import { ComponentType, Fragment, ReactNode, createElement } from 'react';

import { Link } from './link';
import { Route } from './route';

export class NavLinks extends Component {
  route = get(Route);

  Item(props: { route: Route; active: boolean }): ReactNode {
    const { route, active } = props;
    return createElement(Link,
      { to: route.path, 'aria-current': active ? 'page' : undefined },
      route.path
    );
  }

  List(props: { children?: ReactNode }): ReactNode {
    return createElement('ul', null, props.children);
  }

  render() {
    return this.branch(this.route.inner);
  }

  branch(routes: Route[]): ReactNode {
    const { Item, List } = this;

    return createElement(List, null,
      routes.map((route, i) => {
        if (route.redirect) return null;

        return createElement(Fragment, { key: i },
          createElement(Entry, { route, Item }),
          route.inner.length ? this.branch(route.inner) : null
        );
      })
    );
  }
}

type ItemType = ComponentType<{ route: Route; active: boolean }>;

function Entry(props: { route: Route; Item: ItemType }) {
  const route = use(props.route);
  return createElement(props.Item, { route, active: route.matched });
}
