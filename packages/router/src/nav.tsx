import { Component, get } from '@expressive/react';
import { Fragment, ReactNode, createElement } from 'react';

import { Link } from './link';
import { Route } from './route';

export class NavLinks extends Component {
  route = get(Route);

  Item(props: { route: Route }) {
    const { route } = props;
    return createElement(Link, { to: route.path }, route.path);
  }

  List(props: { children?: ReactNode }) {
    return createElement('ul', null, props.children);
  }

  render() {
    return this.branch(this.route.inner);
  }

  branch(routes: Route[]): ReactNode {
    const { Item, List } = this;

    return createElement(List, null,
      routes.map((route, i) =>
        createElement(Fragment, { key: i },
          createElement(Item, { route }),
          route.inner.length ? this.branch(route.inner) : null
        )
      )
    );
  }
}
