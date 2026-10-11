import './App.css';

import { Component, set } from '@expressive/mvc';

export default () => (
  <div className="container">
    <h1>Factories</h1>
    <p>
      A zero-argument function makes the slot a factory: it runs on first access,
      caches its result, and the field is read-only. An <code>async</code> factory
      throws suspense while it pends, so the component's <code>fallback</code>{' '}
      decides what waiting looks like - no loading flag, no effect, no deps. The
      fallback belongs on the component that owns the pending value: a boundary
      above it would rebuild it, and rerun its factory, on every retry.
    </p>
    <p>
      Factories are bound to the instance, so they read sibling fields freely -{' '}
      <code>greeting</code> is synchronous yet waits anyway, because reading a
      pending field suspends it too. Resolution cascades.
    </p>
    <Profile />
    <p>
      Pass <code>false</code> and a factory stops suspending: the field reads{' '}
      <code>undefined</code> until it resolves, then updates like any other.
    </p>
    <Sidebar />
    <small>
      Nothing here is fetched twice - each factory runs once per instance, on the
      first read that needs it.
    </small>
  </div>
);

class Profile extends Component {
  fallback = <p className="pending">loading profile…</p>;

  user = set(async () => {
    return await after(700, { name: 'Ada Lovelace', role: 'Engineer' });
  });

  greeting = set(() => {
    const [first] = this.user.name.split(' ');

    return `Welcome back, ${first}`;
  });

  render() {
    const { user, greeting } = this;

    return (
      <section className="card">
        <h2>{greeting}</h2>
        <small>{user.role}</small>
      </section>
    );
  }
}

class Sidebar extends Component {
  followers = set(async () => {
    return await after(1500, 1204);
  }, false);

  render() {
    const { followers } = this;

    return (
      <p className="pending">
        {followers === undefined
          ? 'counting followers…'
          : `${followers.toLocaleString()} followers`}
      </p>
    );
  }
}

function after<T>(ms: number, value: T) {
  return new Promise<T>((resolve) => setTimeout(resolve, ms, value));
}
