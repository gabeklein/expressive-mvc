import './App.css';

import State, { Component, get, has, Provider } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Downstream</h1>
    <p>
      A <code>true</code> flips the lookup around:{' '}
      <code>get(Candidate, true)</code> collects every candidate mounted below,
      and the array tracks arrivals and departures on its own - nothing registers
      itself, nothing unregisters.
    </p>
    <Provider for={Poll}>
      <Tally />
      <Ballot />
    </Provider>
    <small>
      A callback vets each arrival. Write-ins return <code>false</code> from it, so
      they render and can be chosen - they just never join the roster the tally
      counts.
    </small>
  </div>
);

class Poll extends State {
  candidates = get(Candidate, true, (candidate) => !candidate.writeIn);
  choice = '';
}

class Ballot extends Component {
  slate = has(['Ada', 'Alan', 'Grace']);
  writeIns = has<string>();
  draft = '';

  submit() {
    this.writeIns.push(this.draft.trim() || 'Anonymous');
    this.draft = '';
  }

  render() {
    const { slate, writeIns, draft } = this;

    return (
      <>
        <ul className="ballot">
          {slate.map((name, i) => (
            <Candidate key={name} name={name} remove={() => slate.pop(i)} />
          ))}
          {writeIns.map((name, i) => (
            <Candidate
              key={'+' + name + i}
              name={name}
              writeIn
              remove={() => writeIns.pop(i)}
            />
          ))}
        </ul>

        <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault();
            this.submit();
          }}>
          <input
            value={draft}
            placeholder="Add a write-in"
            onChange={(e) => (this.draft = e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      </>
    );
  }
}

class Candidate extends Component {
  poll = get(Poll);
  name = '';
  writeIn = false;
  remove = () => {};

  render() {
    const { poll, name, writeIn } = this;

    return (
      <li
        className={poll.choice === name ? 'candidate chosen' : 'candidate'}
        onClick={() => (poll.choice = name)}>
        <span>{name}</span>
        {writeIn && <em>write-in</em>}
        <button onClick={() => this.remove()}>×</button>
      </li>
    );
  }
}

const Tally = () => {
  const { candidates, choice } = Poll.get();

  return (
    <p className="tally">
      {candidates.length} on the roster · chose <b>{choice || '—'}</b>
    </p>
  );
};
