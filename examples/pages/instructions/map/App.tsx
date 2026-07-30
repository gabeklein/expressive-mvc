import './App.css';

import { Component, get, map } from '@expressive/react';

const PEOPLE = ['alice', 'bob', 'carol', 'dave'];
const STATUS = ['online', 'away', 'busy'];

export default class Room extends Component {
  people = map((id: string) => new Person({ id, name: capitalize(id) }));
  selected = '';

  protected new() {
    for (const name of PEOPLE) this.people.set(name);
    [this.selected] = PEOPLE;
  }

  render() {
    const { people, selected } = this;
    const active = people.get(selected);

    return (
      <div className="container room">
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
