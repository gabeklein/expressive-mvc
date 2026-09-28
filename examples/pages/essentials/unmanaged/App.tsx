import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/mvc';

export default () => (
  <div className="container">
    <h1>Unmanaged fields</h1>
    <p>
      Type, then pause - the draft saves itself. A <code>_</code> prefix opts a
      field out of state: <code>_timer</code> holds the pending save, so the
      effect and <code>save()</code> can replace or clear it without a render.
      The effect reads <code>delay</code> through <code>is</code>, a silent
      read, so moving the slider sets the next save's delay without restarting
      a pending one.
    </p>
    <Draft delay={600} />
  </div>
);

class Draft extends Component {
  text = '';
  saved = '';
  delay = 1000;

  _timer?: ReturnType<typeof setTimeout>;

  get status() {
    const { text, saved } = this;

    if (text !== saved) return 'Unsaved changes';

    return saved ? 'Saved' : 'Nothing to save';
  }

  mount() {
    this.get((current) => {
      const { text, saved, is } = current;

      clearTimeout(current._timer);

      if (text !== saved)
        current._timer = setTimeout(this.save, is.delay);
    });

    return () => clearTimeout(this._timer);
  }

  save() {
    clearTimeout(this._timer);
    this.saved = this.text;
  }

  render() {
    const { text, saved, delay, status } = this;

    return (
      <div className="draft">
        <textarea
          aria-label="Draft"
          value={text}
          onInput={(e) => (this.text = e.currentTarget.value)}
        />
        <label>
          Delay: {delay}ms
          <input
            type="range"
            min={200}
            max={2000}
            step={100}
            value={delay}
            onInput={(e) => (this.delay = +e.currentTarget.value)}
          />
        </label>
        <p className="status">{status}</p>
        <Button onClick={this.save} disabled={text === saved}>
          Save now
        </Button>
      </div>
    );
  }
}
