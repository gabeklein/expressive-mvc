import './App.css';

import { Component, get, map } from '@expressive/react';

const PEOPLE = [
  ['alice', 'Alice'],
  ['bob', 'Bob'],
  ['carol', 'Carol'],
  ['dave', 'Dave']
];

const STATUS = ['online', 'away', 'busy'];

// The room owns the people, keyed by id, and spawns them with a second
// argument: set(id, name) forwards to the factory. The detail reads
// people.get(selected), which subscribes to that one key - so it
// re-renders when the selected person changes, not when the others do.
export default class Room extends Component {
  people = map((id: string, name: string) => new Person({ id, name }));
  selected = 'alice';

  protected new() {
    for (const [id, name] of PEOPLE) this.people.set(id, name);
  }

  render() {
    const { people, selected } = this;
    const active = people.get(selected);

    return (
      <div className="container room">
        <h1>Presence</h1>
        <p>
          Click a name to select; click a status dot to cycle it. The detail
          reads <code>people.get(selected)</code>, so it tracks only that key.
        </p>

        <div className="layout">
          <ul className="people">{people}</ul>

          <aside className="detail">
            {active ? (
              <>
                <span className={`dot lg ${active.status}`} />
                <h2>{active.name}</h2>
                <p className="status">{active.status}</p>
                <button onClick={() => active.cycle()}>Cycle status</button>
              </>
            ) : (
              <p className="empty">Select someone</p>
            )}
          </aside>
        </div>
      </div>
    );
  }
}

// A person is a spawned, owned member keyed by id. It reads get(Room) to
// reflect and change the selection.
class Person extends Component {
  room = get(Room);
  id = '';
  name = '';
  status = 'online';

  cycle() {
    this.status = STATUS[(STATUS.indexOf(this.status) + 1) % STATUS.length];
  }

  render() {
    const { id, name, status, room } = this;

    return (
      <li
        className={room.selected === id ? 'person selected' : 'person'}
        onClick={() => (room.selected = id)}>
        <span className={`dot ${status}`} onClick={(e) => { e.stopPropagation(); this.cycle(); }} />
        <span className="name">{name}</span>
      </li>
    );
  }
}
