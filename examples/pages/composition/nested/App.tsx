import './App.css';

import State, { Component, get } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Nested State</h1>
    <p>
      A state-typed field is state the parent <em>owns</em>: built with it,
      destroyed with it, and reactive through it. <code>new Track()</code> is the
      ownership form - <code>Track.new()</code> would make a private instance with
      no context at all.
    </p>
    <p>
      Ownership also places the child. Nothing here provides a Track or a Volume,
      yet both are findable below the player, because a child joins whatever
      context its parent belongs to. Provide the parent and you have provided its
      children.
    </p>
    <Player />
    <small>
      Each control reads one child and re-renders only for it - dragging the fader
      leaves the display alone, and neither had to be handed anything.
    </small>
  </div>
);

class Track extends State {
  title = 'Aria in D';
  playing = false;

  toggle() {
    this.playing = !this.playing;
  }
}

class Volume extends State {
  level = 40;
  muted = false;

  get output() {
    return this.muted ? 0 : this.level;
  }
}

class Player extends Component {
  track = new Track();
  volume = new Volume();

  render() {
    const { track } = this;

    return (
      <section className="player">
        <header>
          <h2>{track.title}</h2>
          <small>{track.playing ? 'now playing' : 'paused'}</small>
        </header>

        <Transport />
        <Fader />
      </section>
    );
  }
}

class Transport extends Component {
  track = get(Track);

  render() {
    const { track } = this;

    return (
      <button className="transport" onClick={() => track.toggle()}>
        {track.playing ? 'Pause' : 'Play'}
      </button>
    );
  }
}

class Fader extends Component {
  volume = get(Volume);

  render() {
    const { volume } = this;

    return (
      <label className="fader">
        <span>
          Level <b>{volume.output}</b>
        </span>
        <input
          type="range"
          value={volume.level}
          onChange={(e) => (volume.level = +e.target.value)}
        />
        <button onClick={() => (volume.muted = !volume.muted)}>
          {volume.muted ? 'Unmute' : 'Mute'}
        </button>
      </label>
    );
  }
}
