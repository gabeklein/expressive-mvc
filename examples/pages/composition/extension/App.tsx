import './App.css';

import { Component } from '@expressive/mvc';

export default () => (
  <div className="container">
    <h1>Extending a Base</h1>
    <p>
      Panel renders its chrome and places <code>&lt;this.Body /&gt;</code> where
      content belongs. Each subclass overrides <code>Body</code> - a subcomponent
      bound to the same instance - and leaves <code>render</code> alone, so the
      base keeps its chrome.
    </p>
    <div className="pair">
      <Tally />
      <Notes />
    </div>
    <small>
      Click either header. The chrome, the toggle, and the <code>open</code> field
      behind it all belong to Panel - each subclass wrote only what sits inside,
      and each instance keeps its own state. Collapse one and the base is visibly
      still running the other.
    </small>
  </div>
);

class Panel extends Component {
  title = 'Panel';
  open = true;

  toggle() {
    this.open = !this.open;
  }

  Body(): Component.Node {
    return this.props.children;
  }

  render() {
    const { title, open } = this;

    return (
      <section className="panel">
        <button className="head" aria-expanded={open} onClick={() => this.toggle()}>
          <b>{title}</b>
          <span>{open ? '–' : '+'}</span>
        </button>
        {open && <div className="body"><this.Body /></div>}
      </section>
    );
  }
}

class Tally extends Panel {
  title = 'Tally';
  count = 3;

  Body() {
    const { count } = this;

    return (
      <div className="tally">
        <button onClick={() => this.count--}>−</button>
        <output>{count}</output>
        <button onClick={() => this.count++}>+</button>
      </div>
    );
  }
}

class Notes extends Panel {
  title = 'Notes';
  text = '';

  Body() {
    const { text } = this;

    return (
      <textarea
        rows={2}
        value={text}
        placeholder="Type something, then collapse…"
        onInput={(e) => (this.text = e.currentTarget.value)}
      />
    );
  }
}
