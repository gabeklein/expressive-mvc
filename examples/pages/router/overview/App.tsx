import './App.css';

import { Component, get } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

export default () => (
  <div className="container">
    <h1>Router</h1>
    <p>
      Routes are nested Components. The first matching sibling wins, so the
      literal <code>user/new</code> route sits before <code>user/:name</code>;
      the final <code>none</code> route handles everything else.
    </p>
    <Router>
      <Route as={Frame}>
        <Route as={Home} />
        <Route to="about" as={About} />
        <Route to="user/new" as={NewUser} />
        <Route to="user/:name" as={User} />
        <Route none as={NotFound} />
      </Route>
    </Router>
    <small>
      The headless <code>Router</code> keeps navigation in memory.
      Use <code>BrowserRouter</code> when the address bar participates.
    </small>
  </div>
);

const Frame = (props: { children?: ReactNode }) => (
  <>
    <nav className="nav">
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
      <Link to="/user/new">New user</Link>
      <Link to="/user/ada">User</Link>
      <Link to="/missing">Missing</Link>
    </nav>
    <div className="view">{props.children}</div>
  </>
);

class Home extends Component {
  render() {
    return <p>Welcome. Pick a link - navigation is in-memory here.</p>;
  }
}

class About extends Component {
  render() {
    return <p>Each view is its own Component, matched by its Route.</p>;
  }
}

const NewUser = () => <p>Create a user.</p>;

const NotFound = () => <p>No page matches this URL.</p>;

class User extends Component {
  route = get(Route);

  render() {
    return (
      <p>
        Param <code>name</code> = <b>{this.route.match?.name}</b>
      </p>
    );
  }
}
