import './App.css';

import { Component, get } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

const PAGES = ['intro', 'install', 'api'];

let SEEN = 0;

export default () => (
  <Router>
    <Route as={Frame}>
      <Route as={Index} />
      <Route to="docs" as={Section}>
        <Route to=":page" as={Page} />
      </Route>
    </Route>
  </Router>
);

const Frame = (props: { children?: ReactNode }) => (
  <div className="container">
    <h1>Params</h1>
    <p>
      A <code>:page</code> segment captures whatever sits in that position, and the
      page reads it back off its own route. Handing <code>goto</code> an object
      swaps a param in place instead of composing a path.
    </p>
    <nav className="nav">
      <Link to="/">Home</Link>
      <Link to="/docs/intro">Docs</Link>
    </nav>
    <div className="view">{props.children}</div>
    <small>
      Same-pattern navigation reconciles rather than remounts, so the instance
      number below holds while you switch pages - and only changes when you leave
      the section and come back. The section chrome persists for the same reason.
    </small>
  </div>
);

const Index = () => <p>Pick Docs above to enter a section with a param.</p>;

const Section = (props: { children?: ReactNode }) => (
  <div className="section">
    <header>docs section</header>
    {props.children}
  </div>
);

class Page extends Component {
  route = get(Route);
  instance = ++SEEN;

  render() {
    const { route, instance } = this;

    return (
      <>
        <h2>{route.match?.page}</h2>

        <div className="row">
          {PAGES.map((page) => (
            <button key={page} onClick={() => route.goto({ page })}>
              {page}
            </button>
          ))}
        </div>

        <small>page instance #{instance}</small>
      </>
    );
  }
}
