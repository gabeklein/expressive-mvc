import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Injection</h1>
    <p>
      An activated instance <em>is</em> an element, so rendering one is a matter of
      putting the object you already hold into the tree - no element type to pick,
      no props to forward. The field holding it is the switch: assign a different
      instance and the view swaps.
    </p>
    <Workspace />
    <small>
      Type in one, switch, come back - the text is still there, because the
      instances live on the workspace and only their placement changed. Each is
      bare-constructed, making it nested state the workspace owns.
    </small>
  </div>
);

class Workspace extends Component {
  draft = new Panel({ name: 'Draft' });
  review = new Panel({ name: 'Review' });

  active?: Panel = this.draft;

  render() {
    const { draft, review, active } = this;

    return (
      <>
        <div className="row">
          {[draft, review].map((panel) => (
            <Button
              key={panel.key}
              primary={panel === active}
              onClick={() => (this.active = panel)}>
              {panel.name}
            </Button>
          ))}
          <Button onClick={() => (this.active = undefined)}>Close</Button>
        </div>

        <div className="slot">{active}</div>
      </>
    );
  }
}

class Panel extends Component {
  name = '';
  text = '';

  render() {
    const { name, text } = this;
    const count = text.trim() ? text.trim().split(/\s+/).length : 0;

    return (
      <div className="panel">
        <header>
          <span>{name}</span>
          <small>{count} words</small>
        </header>
        <textarea
          rows={3}
          value={text}
          placeholder={`Write the ${name.toLowerCase()}…`}
          onChange={(e) => (this.text = e.target.value)}
        />
      </div>
    );
  }
}
