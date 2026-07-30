import './App.css';

import State, { Component, get, Provider } from '@expressive/react';

class Poll extends State {
  candidates = get(Candidate, true);
  choice = '';

  get leader() {
    return this.choice || '—';
  }
}

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
