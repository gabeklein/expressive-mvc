import './App.css';

import State, { Component } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

const DOCS = ['charter', 'ledger'];

export default () => (
  <div className="container">
    <h1>Guards</h1>
    <p>
      A <code>redirect</code> function is an entry guard: returning a path
      redirects, returning nothing admits, and <code>null</code> cedes to the
      scope's <code>none</code> Route. Session and router are fields of the
      component declaring the routes, so the guard reads both directly.
    </p>
    <Guarded />
    <small>
      Signed out, both vault links land on sign-in. Signed in, known documents
      open and unknown ones get the vault's not-found page, not the app's. Each
      document is checked on entry. During the check the current screen
      holds; <code>fallback</code> shows only on a cold load.
    </small>
  </div>
);

class Session extends State {
  user: string | null = null;

  toggle() {
    this.user = this.user ? null : 'Ada';
  }
}

class Guarded extends Component {
  session = new Session();
  router = new Router();

  async vet() {
    if (!this.session.user) return '/login';

    await new Promise((resolve) => setTimeout(resolve, 600));

    return DOCS.includes(this.router.path.split('/').pop()!) ? '' : null;
  }

  render() {
    const { vet } = this;

    return (
      <Route as={Frame}>
        <Route as={Lobby} />
        <Route to="login" as={Login} />
        <Route to="vault">
          <Route to=":doc" as={Doc} redirect={vet} fallback={<p className="gate">checking…</p>} />
          <Route none as={VaultNotFound} />
        </Route>
        <Route none as={AppNotFound} />
      </Route>
    );
  }
}

const Frame = (props: { children?: ReactNode }) => (
  <>
    <nav className="nav">
      <Link to="/">Lobby</Link>
      <Link to="/vault/charter">Charter</Link>
      <Link to="/vault/secrets">Secrets</Link>
      <Link to="/missing">Outside vault</Link>
    </nav>
    <div className="view">{props.children}</div>
  </>
);

const Lobby = () => {
  const { user, toggle } = Session.get();

  return (
    <p className="gate">
      {user ? `Signed in as ${user}` : 'Signed out'} -{' '}
      <button onClick={toggle}>{user ? 'Sign out' : 'Sign in'}</button>
    </p>
  );
};

const Login = () => (
  <p className="gate">
    The guard sent you here. Sign in from the lobby, then try the vault again.
  </p>
);

const Doc = () => {
  const { match } = Route.get();

  return <p className="doc">Reading {match?.doc}</p>;
};

const VaultNotFound = () => <p className="gate">No such document in the vault.</p>;

const AppNotFound = () => <p className="gate">No application page matches this URL.</p>;
