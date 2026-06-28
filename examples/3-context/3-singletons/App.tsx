import './App.css';

import State from '@expressive/react';

// A headless, UI-agnostic State of global significance - the kind of
// thing you'd reach for an auth/session store or an API client.
class Auth extends State {
  user: string | null = null;

  get signedIn() {
    return this.user !== null;
  }

  login(name: string) {
    this.user = name;
  }

  logout() {
    this.user = null;
  }
}

// Activate ONCE. `.new()` registers the instance into the root context,
// so `Auth.get()` resolves it anywhere - no Provider, no wiring.
Auth.new();

// Two unrelated components both read the one singleton.
function Header() {
  const { user, signedIn } = Auth.get();

  return <p className="status">{signedIn ? `Signed in as ${user}` : 'Signed out'}</p>;
}

function Controls() {
  const { is: auth, signedIn } = Auth.get();

  return signedIn ? (
    <button onClick={auth.logout}>Log out</button>
  ) : (
    <button onClick={() => auth.login('Ada')}>Log in as Ada</button>
  );
}

export default () => (
  <div className="container">
    <h1>Singletons</h1>
    <Header />
    <Controls />
  </div>
);
