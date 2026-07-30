import './App.css';

import { Component } from '@expressive/react';
import type { ReactNode } from 'react';

export default () => (
  <div className="container">
    <h1>Render Composition</h1>
    <p>
      A subclass that writes its own <code>render</code> does not replace the
      base's - it composes with it. Panel's render runs outermost and the
      subclass's output arrives as <code>props.children</code>. There is no{' '}
      <code>super.render()</code> to call; you read children where content should
      slot.
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

  render(props = {} as { children?: ReactNode }) {
    const { title, open } = this;

    return (
      <section className="panel">
        <header onClick={() => this.toggle()}>
          <b>{title}</b>
          <span>{open ? '–' : '+'}</span>
        </header>
        {open && <div className="body">{props.children}</div>}
      </section>
    );
  }
}

class Tally extends Panel {
  title = 'Tally';
  count = 3;

  render() {
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

  render() {
    const { text } = this;

    return (
      <textarea
        rows={2}
        value={text}
        placeholder="Type something, then collapse…"
        onChange={(e) => (this.text = e.target.value)}
      />
    );
  }
}
