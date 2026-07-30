import './App.css';

import { NavLinks, Link, Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

export default () => (
  <Router>
    <Route as={Frame}>
      <Route as={Home} label="Home" />
      <Route to="guides" label="Guides">
        <Route to="start" as={Page} label="Getting started" />
        <Route to="deploy" as={Page} label="Deploying" />
      </Route>
      <Route to="reference" label="Reference">
        <Route to="api" as={Page} label="API" />
      </Route>
    </Route>
  </Router>
);

const Frame = (props: { children?: ReactNode }) => (
  <div className="container">
    <h1>Navigation</h1>
    <p>
      <code>NavLinks</code> renders the menu from the route tree itself, so the
      JSX that decides what matches also decides what is listed - the two cannot
      drift. Override <code>List</code>, <code>Item</code> and <code>Group</code>{' '}
      to say how each layer looks; a scope with no page of its own arrives as a
      group.
    </p>
    <div className="layout">
      <Menu />
      <div className="view">{props.children}</div>
    </div>
    <small>
      A <code>Link</code> that reads <code>active</code> subscribes to navigation,
      which is all an active-link component ever needed - so there is no NavLink
      here, just a subclass that renders its own anchor.
    </small>
  </div>
);

class Menu extends NavLinks {
  List(props: { children?: ReactNode }) {
    return <nav className="menu">{props.children}</nav>;
  }

  Item(props: { route: Route; label?: string }) {
    return <Tab to={props.route.path}>{props.label}</Tab>;
  }

  Group(props: { route: Route; children?: ReactNode }) {
    return (
      <section className="group">
        <h4>{props.route.label}</h4>
        {props.children}
      </section>
    );
  }
}

class Tab extends Link {
  render() {
    const { href, active, match } = this;

    return (
      <a
        href={href}
        onClick={this.go}
        className={match ? 'tab here' : active ? 'tab near' : 'tab'}>
        {this.props.children}
      </a>
    );
  }
}

const Home = () => <p>Pick anything in the menu.</p>;

const Page = () => {
  const { label, path } = Route.get();

  return (
    <p className="page">
      <b>{label}</b>
      <code>{path}</code>
    </p>
  );
};
