import './App.css';

import { Session } from './Session';
import { Theme } from './Theme';
import { Viewport } from './Viewport';

// Globals: created once, right here, the way you would at your app's entry
// point next to the root render. Two things have to be true for State.get() to
// find one of these anywhere - the class declares `static global = true`, and
// something activates it. State.new() is that second half.
//
// Activation alone is not enough: a class without the declaration stays private
// to its creator, which is what keeps a forgotten Provider from quietly
// installing per-request state into a process-wide registry.
Viewport.new();
Session.new();
Theme.new();

export default function App() {
  return (
    <div className="container">
      <h1>Globals</h1>
      <Size />
      <Account />
      <Appearance />
      <small>
        Three classes declaring <code>static global</code>, each activated once -
        components subscribe with <code>.get()</code> and no Provider anywhere.
      </small>
    </div>
  );
}

// Each component fetches its global with .get() and re-renders only when the
// fields it reads change - no props, no shared parent passing state down.
function Size() {
  const { width, compact } = Viewport.get();
  return (
    <>
      <p className="size">{width}px</p>
      <p>{compact ? 'Compact layout' : 'Wide layout'}</p>
    </>
  );
}

function Account() {
  const { user, login, logout } = Session.get();
  return user ? (
    <p>
      Signed in as {user} - <button onClick={logout}>Log out</button>
    </p>
  ) : (
    <p>
      Signed out - <button onClick={login}>Log in</button>
    </p>
  );
}

function Appearance() {
  const { dark, toggle } = Theme.get();
  return (
    <p>
      <button onClick={toggle}>{dark ? 'Dark' : 'Light'} theme</button>
    </p>
  );
}
