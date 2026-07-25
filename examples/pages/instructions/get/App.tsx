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

  add() {
    this.roster = [...this.roster, `Guest ${this.roster.length + 1}`];
  }

  render() {
    return (
      <div className="container">
        <h1>Context Collection</h1>

        <Provider for={Poll}>
          <Tally />
          <ul className="ballot">
            {this.roster.map((name) => (
              <Candidate key={name} name={name} />
            ))}
          </ul>
          <button onClick={() => this.add()}>Add candidate</button>
        </Provider>
      </div>
    );
  }
}
