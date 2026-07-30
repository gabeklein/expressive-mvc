import './App.css';

import { Component, get } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Upstream</h1>
    <p>
      <code>get(Desk)</code> hands a channel the desk it lives under - located by
      class, never threaded through props. A <code>Component</code> is in context
      for everything it renders, so the desk provides itself just by being one.
    </p>
    <Desk />
    <p>
      Pass <code>false</code> and the lookup turns optional. The meter below
      renders outside the desk and reports what it found - same class as the one
      inside, no standalone variant.
    </p>
    <Meter />
    <small>
      The field is typed as the class you asked for, so <code>desk.</code>{' '}
      completes to real fields and methods - and a rename moves every reader
      with it.
    </small>
  </div>
);

class Desk extends Component {
  master = 70;
  channels = ['Drums', 'Bass', 'Keys'];

  render() {
    const { master, channels } = this;

    return (
      <section className="desk">
        <label className="master">
          <span>
            Master <b>{master}%</b>
          </span>
          <input
            type="range"
            value={master}
            onChange={(e) => (this.master = +e.target.value)}
          />
        </label>

        <div className="channels">
          {channels.map((name) => (
            <Channel key={name} name={name} />
          ))}
        </div>

        <Meter />
      </section>
    );
  }
}

class Channel extends Component {
  desk = get(Desk);
  name = '';
  level = 50;

  render() {
    const { desk, name, level } = this;

    return (
      <div className="channel">
        <header>{name}</header>
        <input
          type="range"
          value={level}
          onChange={(e) => (this.level = +e.target.value)}
        />
        <output>{Math.round((level * desk.master) / 100)}%</output>
      </div>
    );
  }
}

class Meter extends Component {
  desk = get(Desk, false);

  render() {
    const { desk } = this;

    return (
      <p className="meter">
        {desk ? `bus riding at ${desk.master}%` : 'no desk in context - idle'}
      </p>
    );
  }
}
