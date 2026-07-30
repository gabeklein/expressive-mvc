import './App.css';

import State, { Component, get, has } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Nested State</h1>
    <p>
      A state-typed field is state the parent <em>owns</em>: built with it,
      destroyed with it. <code>new Doc()</code> is the ownership form -{' '}
      <code>Doc.new()</code> would make a private instance with no context at all.
    </p>
    <p>
      Ownership also places it. Nothing here provides a Doc or a History, yet the
      toolbar two levels down finds both - a child joins whatever context its
      parent belongs to, so providing the parent provides its children.
    </p>
    <Workspace />
    <small>
      Close the editor and both go with it: reopen to an empty sheet and no
      history. Neither child had to unregister or clean up after itself - their
      lifetime was their owner's all along.
    </small>
  </div>
);

class Doc extends State {
  text = '';

  get words() {
    const words = this.text.trim();

    return words ? words.split(/\s+/).length : 0;
  }
}

class History extends State {
  entries = has<string>();

  record(text: string) {
    this.entries.push(text);
  }

  undo() {
    return this.entries.pop();
  }
}

class Workspace extends Component {
  open = true;

  render() {
    const { open } = this;

    return (
      <>
        {open && <Editor />}

        <button onClick={() => (this.open = !open)}>
          {open ? 'Close' : 'Open'} editor
        </button>
      </>
    );
  }
}

class Editor extends Component {
  doc = new Doc();
  history = new History();

  render() {
    return (
      <section className="editor">
        <Toolbar />
        <Sheet />
      </section>
    );
  }
}

const Toolbar = () => (
  <header className="toolbar">
    <Undo />
    <Words />
  </header>
);

class Undo extends Component {
  doc = get(Doc);
  history = get(History);

  revert() {
    const previous = this.history.undo();

    if (previous !== undefined) this.doc.text = previous;
  }

  render() {
    const { history } = this;

    return (
      <button disabled={!history.entries.size} onClick={() => this.revert()}>
        Undo {history.entries.size || ''}
      </button>
    );
  }
}

class Words extends Component {
  doc = get(Doc);

  render() {
    return <small>{this.doc.words} words</small>;
  }
}

class Sheet extends Component {
  doc = get(Doc);
  history = get(History);

  write(text: string) {
    this.history.record(this.doc.text);
    this.doc.text = text;
  }

  render() {
    return (
      <textarea
        rows={3}
        value={this.doc.text}
        placeholder="Write something, then undo it…"
        onChange={(e) => this.write(e.target.value)}
      />
    );
  }
}
