import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Instances</h1>
    <p>
      An activated instance is an element. Hold one as a field and that field
      becomes the switch - assign a different instance and the view swaps, while
      whatever left the tree keeps its state.
    </p>
    <Workspace />
    <small>
      Type in one, switch, come back - the text is still there. The field decides
      what renders, never what exists.
    </small>
  </div>
);

class Workspace extends Component {
  // Bare construction makes each panel nested state this component owns: built
  // here, activated into this context, and destroyed with it.
  draft = new Panel({ name: 'Draft' });
  review = new Panel({ name: 'Review' });

  // Which one renders. Assigning here neither creates nor destroys a panel, so
  // switching away is not an unmount in the sense that loses anything.
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

        {/* An instance placed straight into the tree. It supplies its own key
            from the readonly `key` field, defaulting to the State uid. */}
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
