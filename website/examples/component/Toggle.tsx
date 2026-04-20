import { Component } from '@expressive/react';

// Toggle is a small Component with everything baked in - state, behavior,
// and a default look. We could use it as-is, but the more interesting
// move is extending it just to swap the look while inheriting the rest.

export class Toggle extends Component {
  on = false;
  label = '';

  flip() {
    this.on = !this.on;
  }

  render() {
    const { on, label, flip } = this;

    return (
      <button onClick={flip}>
        {label}: {on ? 'ON' : 'OFF'}
      </button>
    );
  }
}
