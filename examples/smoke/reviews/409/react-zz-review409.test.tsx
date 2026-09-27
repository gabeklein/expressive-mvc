import { render, act } from '@testing-library/react';
import { it, vi } from 'vitest';
import React from 'react';
import { mockPromise } from '../test.setup';
import { Component, State } from '.';

it('react adapter: first-mount suspension and sibling state', async () => {
  const gate = mockPromise<void>();
  let done = false;
  let made = 0;
  class Local extends State {
    n = 0;
    protected new() { made++; }
  }
  function Counter() {
    const { n } = Local.use();
    return <b>{n}</b>;
  }
  function Slow() {
    if (!done) throw gate;
    return <span>!</span>;
  }
  class App extends Component {
    fallback = <i>loading</i>;
    render() { return <div><Counter /><Slow /></div>; }
  }
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(<App />);
  console.log('react initial', container.textContent);
  await act(async () => { done = true; gate.resolve(); });
  console.log('react after', container.textContent, 'Local constructed', made);
  error.mockRestore();
});

it('react adapter: handled error logging', async () => {
  let fail = true;
  function Boom(): any { if (fail) throw new Error('boom'); return <p>ok</p>; }
  class App extends Component {
    fallback = <i>oops</i>;
    catch() { fail = false; }
    render() { return <Boom />; }
  }
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(<App />);
  await act(async () => {});
  await act(async () => {});
  console.log('react handled', container.textContent, 'console.error', error.mock.calls.length);
  error.mockRestore();
});

it('react adapter: parent write re-renders children', async () => {
  const counts = { app: 0, leaf: 0 };
  function Leaf() { counts.leaf++; return <i />; }
  class App extends Component {
    a = 0;
    render() { counts.app++; const { a } = this; return <div>{a}<Leaf /></div>; }
  }
  let app!: App;
  render(<App is={(v: App) => (app = v)} />);
  await act(async () => { app.a = 1; });
  console.log('react counts', JSON.stringify(counts));
});
