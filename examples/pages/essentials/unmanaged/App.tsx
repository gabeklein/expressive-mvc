import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/mvc';

export default () => (
  <div className="container">
    <h1>Unmanaged fields</h1>
    <p>
      Type, then pause - the draft saves itself. <code>text</code> and{' '}
      <code>saves</code> are state. A <code>_</code> prefix opts a field out:{' '}
      <code>_delay</code> and <code>_timer</code> are plain values, so writing
      them never renders, even from inside an effect. <code>#saved</code> is
      private; the <code>_saved</code> getter runs on the instance, so the
      effect, the <code>status</code> computed and <code>render</code> can all
      read it.
    </p>
    <Draft _delay={600} />
    <small>
      <code>_delay</code> arrives as a prop like any field. Only{' '}
      <code>saves</code> changing re-renders the status after a save -{' '}
      <code>#saved</code> itself is invisible to subscribers.
    </small>
  </div>
);

class Draft extends Component {
  text = '';
  saves = 0;

  _delay = 1000;
  _timer?: ReturnType<typeof setTimeout>;

  #saved = '';

  get _saved() {
    return this.#saved;
  }

  get status() {
    const { text, saves } = this;

    if (text !== this._saved) return 'Unsaved changes';

    return saves ? `Saved ${saves} ${saves == 1 ? 'time' : 'times'}` : 'Nothing to save';
  }

  mount() {
    this.get((current) => {
      const { text } = current;

      clearTimeout(current._timer);

      if (text !== current._saved)
        current._timer = setTimeout(this.save, current._delay);
    });

    return () => clearTimeout(this._timer);
  }

  save() {
    clearTimeout(this._timer);

    if (this.text === this.#saved) return;

    this.#saved = this.text;
    this.saves++;
  }

  render() {
    const { text, status } = this;

    return (
      <div className="draft">
        <textarea
          aria-label="Draft"
          value={text}
          onInput={(e) => (this.text = e.currentTarget.value)}
        />
        <p className="status">{status}</p>
        <Button onClick={this.save} disabled={text === this._saved}>
          Save now
        </Button>
      </div>
    );
  }
}
