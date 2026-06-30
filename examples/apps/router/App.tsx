import './App.css';

import { Component, get } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';

// Routes ARE Components. The layout renders the nav once; the matched
// child arrives as `props.children`.
class Layout extends Component {
  render() {
    return (
      <div className="container">
        <h1>Router</h1>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/user/ada">User</Link>
        </nav>
        <div className="view">{this.props.children}</div>
      </div>
    );
  }
}

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

// A page reads its own Route from context for params, match, navigation.
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

export default () => (
  <Router>
    <Route as={Layout}>
      <Route as={Home} />
      <Route to="about" as={About} />
      <Route to="user/:name" as={User} />
    </Route>
  </Router>
);
