import './App.css';

import State, { Component } from '@expressive/react';
import { Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

export default () => (
  <div className="container">
    <h1>Wizard</h1>
    <p>
      Steps are sibling routes, not a counter. Each entry guard names the first
      missing step, so direct navigation, Back, and Continue obey the same rules.
    </p>
    <Wizard />
    <small>
      The parent Route exposes its children in declaration order and its active
      child. Progress and controls derive from that route tree instead of
      duplicating navigation state.
    </small>
  </div>
);

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

class Wizard extends Component {
  application = new Application();
  router = new Router({ path: '/name' });

  details() {
    return this.application.name.trim() ? '' : '/name';
  }

  review() {
    return this.application.incomplete;
  }

  done() {
    const { incomplete, submitted } = this.application;
    return submitted ? '' : incomplete || '/review';
  }

  render() {
    const { details, done, review } = this;

    return (
      <Route as={Frame}>
        <Route to="name" as={Name} label="Name" />
        <Route to="details" as={Details} label="Details"
          redirect={details} />
        <Route to="review" as={Review} label="Review"
          redirect={review} />
        <Route to="done" as={Done}
          redirect={done} />
        <Route none redirect="/name" />
      </Route>
    );
  }
}

const Frame = (props: { children?: ReactNode }) => (
  <>
    <Progress />
    <div className="view">{props.children}</div>
  </>
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
