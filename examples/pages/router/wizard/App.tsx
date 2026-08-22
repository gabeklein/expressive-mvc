import './App.css';

import State, { Provider } from '@expressive/react';
import { Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

class Application extends State {
  name = '';
  email = '';
  agreed = false;
  submitted = false;

  get incomplete() {
    return !this.name.trim() ? '/name'
      : !this.email.includes('@') ? '/details'
      : '';
  }
}

const app = Application.new();

export default () => (
  <Provider for={app}>
    <Router>
      <Route as={Frame}>
        <Route redirect="/name" />
        <Route to="name" as={Name} label="Name" />
        <Route to="details" as={Details} label="Details"
          redirect={() => app.name.trim() ? '' : '/name'} />
        <Route to="review" as={Review} label="Review"
          redirect={() => app.incomplete} />
        <Route to="done" as={Done}
          redirect={() => app.submitted ? '' : app.incomplete || '/review'} />
      </Route>
    </Router>
  </Provider>
);

const Frame = (props: { children?: ReactNode }) => (
  <div className="container">
    <h1>Wizard</h1>
    <p>
      Steps are plain sibling routes, so the wizard keeps no step counter: each
      step's <code>redirect</code> guard names the first thing still missing,
      and admission takes care of itself. The buttons only navigate - click a
      later step or Continue too early and the guard walks you back.
    </p>
    <Progress />
    <div className="view">{props.children}</div>
    <small>
      The parent route's <code>inner</code> lists the steps in declaration
      order and <code>active</code> marks the current one - progress and the
      Back/Continue pair are derived from those, never tracked by hand.
    </small>
  </div>
);

const Progress = () => {
  const { active, inner, router } = Route.get();
  const steps = inner.filter((route) => route.label);
  const at = active ? steps.indexOf(active) : 0;

  return (
    <nav className="steps">
      {steps.map((step, i) => (
        <button
          key={step.path}
          className={i === at ? 'step here' : at < 0 || i < at ? 'step past' : 'step'}
          onClick={() => router.goto(step.path)}>
          <b>{i + 1}</b> {step.label}
        </button>
      ))}
    </nav>
  );
};

const Controls = (props: { children?: ReactNode }) => {
  const { parent, path, router } = Route.get();
  const steps = parent!.inner.filter((route) => route.label);
  const at = steps.findIndex((step) => step.path === path);
  const back = steps[at - 1];
  const next = steps[at + 1];

  return (
    <div className="controls">
      <button disabled={!back} onClick={() => router.goto(back.path)}>
        Back
      </button>
      {props.children || (
        <button onClick={() => router.goto(next.path)}>Continue</button>
      )}
    </div>
  );
};

const Name = () => {
  const { is: me, name } = Application.get();

  return (
    <div className="card">
      <label>
        Full name
        <input
          value={name}
          placeholder="Ada Lovelace"
          onChange={(e) => (me.name = e.target.value)}
        />
      </label>
      <Controls />
    </div>
  );
};

const Details = () => {
  const { is: me, email } = Application.get();

  return (
    <div className="card">
      <label>
        Email address
        <input
          value={email}
          placeholder="ada@analytical.engine"
          onChange={(e) => (me.email = e.target.value)}
        />
      </label>
      <Controls />
    </div>
  );
};

const Review = () => {
  const { is: me, name, email, agreed } = Application.get();
  const { router } = Route.get();

  const submit = () => {
    me.submitted = true;
    router.goto('/done');
  };

  return (
    <div className="card">
      <dl>
        <dt>Name</dt>
        <dd>{name}</dd>
        <dt>Email</dt>
        <dd>{email}</dd>
      </dl>
      <label className="agree">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => (me.agreed = e.target.checked)}
        />
        Everything above is correct.
      </label>
      <Controls>
        <button disabled={!agreed} onClick={submit}>
          Submit
        </button>
      </Controls>
    </div>
  );
};

const Done = () => {
  const { is: me, name } = Application.get();
  const { router } = Route.get();

  const restart = () => {
    me.name = '';
    me.email = '';
    me.agreed = false;
    me.submitted = false;
    router.goto('/name');
  };

  return (
    <div className="card done">
      <p>Application received. Thanks, {name}!</p>
      <button onClick={restart}>Start over</button>
    </div>
  );
};
