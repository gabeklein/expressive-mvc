/** @jsxImportSource @expressive/dom */
import './App.css';

import { State, Component, get, has } from '@expressive/mvc';
import { Provider } from '@expressive/dom';

export default () => (
  <div class="container">
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
        <ul class="ballot">
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
          class="add"
          onSubmit={(e) => {
            e.preventDefault();
            this.submit();
          }}>
          <input
            value={draft}
            placeholder="Add a write-in"
            onInput={(e) => (this.draft = e.target.value)}
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

  drop(event: { stopPropagation(): void }) {
    event.stopPropagation();

    if (this.poll.choice === this.name) this.poll.choice = '';

    this.remove();
  }

  render() {
    const { poll, name, writeIn, drop } = this;

    return (
      <li
        class={poll.choice === name ? 'candidate chosen' : 'candidate'}
        onClick={() => (poll.choice = name)}>
        <span>{name}</span>
        {writeIn && <em>write-in</em>}
        <button onClick={drop}>×</button>
      </li>
    );
  }
}

const Tally = () => {
  const { candidates, choice } = Poll.get();

  return (
    <p class="tally">
      {candidates.length} on the roster · chose <b>{choice || '—'}</b>
    </p>
  );
};
