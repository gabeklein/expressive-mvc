import './App.css';

import State, { Component, get, Provider } from '@expressive/react';

// The same instruction reaches both directions of the context tree.
// Downstream: get(Candidate, true) collects every Candidate mounted below,
// and the array tracks them as they mount and unmount - no registration.
class Poll extends State {
  candidates = get(Candidate, true);
  choice = '';

  get leader() {
    return this.choice || '—';
  }
}

// Upstream: get(Poll) hands each Candidate the poll it lives under, so a
// click writes the shared choice and every candidate restyles.
class Candidate extends Component {
  poll = get(Poll);
  name = '';

  render() {
    const { poll, name } = this;

    return (
      <li
        className={poll.choice === name ? 'candidate chosen' : 'candidate'}
        onClick={() => (poll.choice = name)}>
        {name}
      </li>
    );
  }
}

// A separate consumer reads the collected array - it re-renders as the
// roster grows or shrinks, and when the shared choice changes.
function Tally() {
  const { candidates, leader } = Poll.get();

  return (
    <p className="tally">
      {candidates.length} on the ballot · chose <b>{leader}</b>
    </p>
  );
}

export default class App extends Component {
  roster = ['Ada', 'Alan', 'Grace'];
  draft = '';

  add() {
    const name = this.draft.trim() || `Guest ${this.roster.length + 1}`;
    this.roster = [...this.roster, name];
    this.draft = '';
  }

  render() {
    const { roster, draft } = this;

    return (
      <div className="container">
        <h1>Context Collection</h1>

        <Provider for={Poll}>
          <Tally />
          <ul className="ballot">
            {roster.map((name) => (
              <Candidate key={name} name={name} />
            ))}
          </ul>
          <form
            className="add"
            onSubmit={(e) => {
              e.preventDefault();
              this.add();
            }}>
            <input
              value={draft}
              placeholder={`Guest ${roster.length + 1}`}
              onChange={(e) => (this.draft = e.target.value)}
            />
            <button type="submit">Add</button>
          </form>
        </Provider>
      </div>
    );
  }
}
