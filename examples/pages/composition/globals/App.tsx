import './App.css';

import { Session } from './Session';
import { Theme } from './Theme';
import { Viewport } from './Viewport';

Viewport.new();
Session.new();
Theme.new();

export default () => (
  <div className="container">
    <h1>Globals</h1>
    <p>
      Three states created once up here, the way you would beside the root render.
      Reaching one anywhere takes two halves: the class declares{' '}
      <code>static global</code>, and <code>.new()</code> activates it. Activation
      alone leaves an instance private to whoever made it - which is what keeps a
      forgotten Provider from installing per-request state process-wide.
    </p>
    <div className="cards">
      <Size />
      <Account />
      <Appearance />
    </div>
    <small>
      No Provider anywhere. Each card calls <code>.get()</code> and subscribes to
      only the fields it reads - resize the window and just the first one moves.
    </small>
  </div>
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
