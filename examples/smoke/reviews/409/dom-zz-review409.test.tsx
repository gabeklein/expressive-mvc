import { describe, expect, it, vi } from 'vitest';

import { Component, State, pending } from '@expressive/mvc';
import { lazy, render } from './index';
import { flushMicrotasks, mockPromise } from '../test.setup';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('review 409', () => {
  it('update scope: only reader re-renders; parent write reruns children', async () => {
    const counts = { app: 0, child: 0, leaf: 0 };

    class App extends Component {
      a = 0;
      b = 0;
      render() {
        counts.app++;
        const { a } = this;
        return <div>{a}<Child /><Leaf /></div>;
      }
    }
    function Child() {
      counts.child++;
      return <span>{App.get().b}</span>;
    }
    function Leaf() {
      counts.leaf++;
      return <i />;
    }

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(v) => (app = v)} />, root);
    expect(counts).toEqual({ app: 1, child: 1, leaf: 1 });

    app.b = 1;
    await flushMicrotasks();
    console.log('after child-only write', JSON.stringify(counts));

    app.a = 1;
    await flushMicrotasks();
    console.log('after parent write', JSON.stringify(counts));
  });

  it('class child re-renders on parent re-render too?', async () => {
    const counts = { app: 0, kid: 0 };
    class Kid extends Component {
      render() { counts.kid++; return <i>kid</i>; }
    }
    class App extends Component {
      a = 0;
      render() { counts.app++; const { a } = this; return <div>{a}<Kid /></div>; }
    }
    let app!: App;
    const root = document.createElement('main');
    render(<App is={(v) => (app = v)} />, root);
    app.a = 1;
    await flushMicrotasks();
    console.log('class child', JSON.stringify(counts));
  });

  it('first-mount suspension keeps sibling state', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);
    let made = 0;
    class Local extends State {
      n = 0;
      protected new() { made++; }
    }
    let local!: Local;
    function Counter() {
      const l = Local.use();
      local = l.is;
      return <b>{l.n}</b>;
    }
    class App extends Component {
      fallback = <i>loading</i>;
      render() { return <div><Counter /><Lazy /></div>; }
    }
    const root = document.createElement('main');
    render(<App />, root);
    expect(root.textContent).toBe('loading');
    local.n = 5;
    await flushMicrotasks();
    loaded.resolve(() => <span>!</span>);
    await flushMicrotasks();
    console.log('sibling after reveal', root.textContent, 'made', made);
  });

  it('default Component boundary: fallback null swallows suspension', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);
    class Inner extends Component {
      render() { return <Lazy />; }
    }
    class Outer extends Component {
      fallback = <i>loading</i>;
      render() { return <div><p>x</p><Inner /></div>; }
    }
    const root = document.createElement('main');
    render(<Outer />, root);
    console.log('default boundary text:', JSON.stringify(root.textContent));
  });

  it('handled errors are not logged', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    function Boom(): any {
      if (fail) throw new Error('boom');
      return <p>ok</p>;
    }
    class App extends Component {
      fallback = <i>oops</i>;
      catch() { fail = false; }
      render() { return <Boom />; }
    }
    const root = document.createElement('main');
    render(<App />, root);
    await flushMicrotasks();
    await flushMicrotasks();
    console.log('handled:', root.textContent, 'console.error calls', error.mock.calls.length);
    error.mockRestore();
  });

  it('unhandled update error is logged via console.error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    class App extends Component {
      fallback = false as const;
      bad = false;
      render(): any { if (this.bad) throw new Error('bad'); return <p>ok</p>; }
    }
    let app!: App;
    const root = document.createElement('main');
    render(<App is={(v) => (app = v)} />, root);
    app.bad = true;
    await flushMicrotasks();
    console.log('unhandled update error logged:', error.mock.calls.length, 'text', root.textContent);
    error.mockRestore();
  });

  it('writes flush asynchronously, not per write', async () => {
    class App extends Component {
      a = 0;
      render() { return <p>{this.a}</p>; }
    }
    let app!: App;
    const root = document.createElement('main');
    render(<App is={(v) => (app = v)} />, root);
    app.a = 1;
    const sync = root.textContent;
    await flushMicrotasks();
    console.log('sync after write:', sync, 'after microtask:', root.textContent);
  });

  it('transition gap: two scopes disagree during a deep suspension', async () => {
    const gate = mockPromise<void>();
    let open = false;
    class Nav extends State { page = 'a'; }
    function Address() { return <b>{Nav.get().page}</b>; }
    function Deep() {
      const { page } = Nav.get();
      if (page == 'b' && !open) throw gate;
      return <span>{page}</span>;
    }
    function Page() {
      const { page } = Nav.get();
      return <section><em>{page}</em><Deep /></section>;
    }
    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;
      render() { return <div><Address /><Page /></div>; }
    }
    let app!: App;
    const root = document.createElement('main');
    render(<App is={(v) => (app = v)} />, root);
    console.log('initial:', root.textContent);
    pending(() => { app.nav.page = 'b'; });
    await tick();
    console.log('during transition:', root.textContent);
    open = true;
    gate.resolve();
    await tick();
    console.log('after:', root.textContent);
  });

  it('controlled value is property only', () => {
    const root = document.createElement('main');
    render(<input value="hi" />, root);
    const input = root.querySelector('input')!;
    console.log('value prop', input.value, 'attr', input.getAttribute('value'));
  });
});
