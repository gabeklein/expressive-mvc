import './App.css';

import { Component, get } from '@expressive/react';
import type { ReactNode } from 'react';

export default () => (
  <div className="container">
    <h1>Upstream</h1>
    <p>
      <code>get(Form)</code> locates the nearest form by class, not by prop. A{' '}
      <code>Component</code> is in context for everything it renders, so the form
      provides itself just by being one - and every field below finds it, however
      deep it sits.
    </p>
    <Form />
    <p>
      With <code>false</code> the lookup is optional. This is the same Field class,
      rendered outside any form: it finds nothing, says so, and still works.
    </p>
    <Field label="Nickname" />
    <small>
      One class covers both placements because the answer is typed{' '}
      <code>Form | undefined</code> - the compiler makes you handle the standalone
      case, rather than a missing provider making you find out at runtime.
    </small>
  </div>
);

class Form extends Component {
  locked = false;

  render() {
    const { locked } = this;

    return (
      <form className="signup" onSubmit={(e) => e.preventDefault()}>
        <Field label="Name" />

        <Group title="Contact">
          <Field label="Email" />
        </Group>

        <footer>
          <button type="button" onClick={() => (this.locked = !locked)}>
            {locked ? 'Unlock' : 'Lock'} form
          </button>
        </footer>
      </form>
    );
  }
}

class Field extends Component {
  form = get(Form, false);
  label = '';
  value = '';

  render() {
    const { form, label, value } = this;

    return (
      <label className="field">
        <span>
          {label}
          <small>{form ? 'in a form' : 'no form above'}</small>
        </span>
        <input
          value={value}
          disabled={form?.locked}
          placeholder={form?.locked ? 'locked' : `Your ${label.toLowerCase()}`}
          onChange={(e) => (this.value = e.target.value)}
        />
      </label>
    );
  }
}

const Group = (props: { title: string; children?: ReactNode }) => (
  <fieldset className="group">
    <legend>{props.title}</legend>
    {props.children}
  </fieldset>
);
