import './App.css';

import { Global, Session, Theme, Viewport } from './Global';

export default () => (
  <Global>
    <div className="container">
      <h1>App-wide state</h1>
      <p>
        The app's top component owns three states and provides them with itself,
        so anything below reaches each by type.
      </p>
      <div className="cards">
        <Size />
        <Account />
        <Appearance />
      </div>
      <small>
        Each card calls <code>.get()</code> and subscribes to only the fields it
        reads - resize the window and just the first one moves.
      </small>
    </div>
  </Global>
);

const Size = () => {
  const { width, compact } = Viewport.get();

  return (
    <article className="card">
      <h2>Viewport</h2>
      <b>{width}px</b>
      <small>{compact ? 'compact layout' : 'wide layout'}</small>
    </article>
  );
};

const Account = () => {
  const { user, login, logout } = Session.get();

  return (
    <article className="card">
      <h2>Session</h2>
      <b>{user ?? 'signed out'}</b>
      {user ? (
        <button onClick={logout}>Log out</button>
      ) : (
        <button onClick={login}>Log in</button>
      )}
    </article>
  );
};

const Appearance = () => {
  const { dark, toggle } = Theme.get();

  return (
    <article className="card">
      <h2>Theme</h2>
      <b>{dark ? 'dark' : 'light'}</b>
      <button onClick={toggle}>Switch</button>
    </article>
  );
};
