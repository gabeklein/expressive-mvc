import './App.css';

import { Link, Route, Router } from '@expressive/router';
import type { PropsWithChildren } from 'react';

const Layout = ({ children }: PropsWithChildren) => (
  <div className="container">
    <h1>Router</h1>
    <nav className="nav">
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
      <Link to="/user/ada">User</Link>
    </nav>
    <div className="view">{children}</div>
  </div>
);

const Home = () => <p>Welcome. Pick a link - navigation is in-memory here.</p>;

const About = () => <p>Each view is its own Component, matched by its Route.</p>;

// A page reads its own Route from context for params, match, navigation.
const User = () => {
  const route = Route.get();
  return <p>Param <code>name</code> = <b>{route.match?.name}</b></p>;
};

export default () => (
  <Router>
    <Route as={Layout}>
      <Route as={Home} />
      <Route to="about" as={About} />
      <Route to="user/:name" as={User} />
    </Route>
  </Router>
);
