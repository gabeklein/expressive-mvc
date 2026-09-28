import './App.css';

import Button from '@common/Button';
import { Component, State, has } from '@expressive/mvc';

const server = createServer();

export default () => (
  <div className="container">
    <h1>Private fields</h1>
    <p>
      Sign in, then load your notes. <code>user</code> and <code>notes</code>{' '}
      are state the UI renders. The session token is <code>#token</code> - a
      JavaScript private field on the <code>Session</code> the view owns. Only the class's own methods reach it, and the
      reactive system never sees it: it is not rendered, not exported by{' '}
      <code>get()</code>, and cannot be set from outside.
    </p>
    <Account />
    <small>
      Keep <code>#</code> fields on a <code>State</code> and use them from
      methods. A Component may be constructed twice under React StrictMode,
      which a private field does not survive; getters and{' '}
      <code>render()</code> run against a tracking proxy, which cannot read
      them.
    </small>
  </div>
);

class Session extends State {
  user = '';
  busy = false;
  notes = has<string>();

  #token = '';

  async signIn(name: string) {
    this.busy = true;
    this.#token = await server.signIn(name);
    this.user = name;
    this.busy = false;
  }

  async load() {
    this.busy = true;
    this.notes.clear();
    this.notes.push(...(await server.notes(this.#token)));
    this.busy = false;
  }

  signOut() {
    this.#token = '';
    this.user = '';
    this.notes.clear();
  }
}

class Account extends Component {
  name = 'Ada';
  session = new Session();

  render() {
    const { name, session } = this;
    const { user, busy, notes } = session;

    if (user)
      return (
        <div className="session">
          <p>Signed in as <b>{user}</b></p>
          <div className="actions">
            <Button primary onClick={session.load} disabled={busy}>Load notes</Button>
            <Button onClick={session.signOut}>Sign out</Button>
          </div>
          <ul>
            {notes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </div>
      );

    return (
      <div className="session">
        <label>
          Name
          <input value={name} onInput={(e) => (this.name = e.currentTarget.value)} />
        </label>
        <Button primary onClick={() => session.signIn(name)} disabled={busy || !name}>
          Sign in
        </Button>
      </div>
    );
  }
}

function createServer() {
  const sessions = new Map<string, string>();
  const wait = () => new Promise((resolve) => setTimeout(resolve, 300));

  return {
    async signIn(name: string) {
      await wait();
      const token = Math.random().toString(36).slice(2);
      sessions.set(token, name);
      return token;
    },
    async notes(token: string) {
      await wait();
      const name = sessions.get(token);
      if (!name) throw new Error('Not signed in.');
      return [`Welcome back, ${name}.`, 'Your token never left the Session class.'];
    }
  };
}
