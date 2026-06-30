import './App.css';

import { Session } from './Session';
import { Theme } from './Theme';
import { Viewport } from './Viewport';

// Singletons: created once, right here, the way you would at your app's entry
// point next to the root render. State.new() activates the instance and parks
// it in the global context, so any component can reach it with State.get().
Viewport.new();
Session.new();
Theme.new();

export default function App() {
  return (
    <div className="container">
      <h1>Singletons</h1>
      <Size />
      <Account />
      <Appearance />
      <small>Three singletons, each created once - components subscribe with `.get()`.</small>
    </div>
  );
}

// Each component fetches its singleton with .get() and re-renders only when the
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
