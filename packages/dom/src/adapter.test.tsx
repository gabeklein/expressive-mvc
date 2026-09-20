import { describe, expect, it, vi } from 'vitest';

import State, { Component, Consumer, Provider, render } from './index';
import { Context } from '@expressive/mvc';
import { commit, dispose, enter } from './adapter';
import type { Scope } from './adapter';
import { flushMicrotasks, mockPromise } from '../test.setup';

describe('MVC adapter', () => {
  it('will render a Component and update only an accessed field', async () => {
    const renders = vi.fn();
    const cleanup = vi.fn();

    class Counter extends Component {
      count = 0;
      ignored = 0;

      increment() {
        this.count++;
      }

      mount() {
        return cleanup;
      }

      render() {
        renders();
        const { count, increment } = this;
        return <button onClick={increment}>{count}</button>;
      }
    }

    const root = document.createElement('main');
    let counter!: Counter;
    const release = render(<Counter is={(value) => (counter = value)} />, root);

    expect(root.textContent).toBe('0');
    expect(renders).toHaveBeenCalledOnce();

    counter.ignored++;
    await flushMicrotasks();
    expect(renders).toHaveBeenCalledOnce();

    root.querySelector('button')!.click();
    await flushMicrotasks();
    expect(root.textContent).toBe('1');
    expect(renders).toHaveBeenCalledTimes(2);

    release();
    expect(counter.get(null)).toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('will own State.use within a stable function-component slot', async () => {
    const lifecycle: string[] = [];
    let local!: Local;

    class Local extends State {
      value = 0;
      count = 0;

      new() {
        local = this;
        lifecycle.push('new');
      }

      mount() {
        lifecycle.push('mount');
        return () => lifecycle.push('unmount');
      }
    }

    function Value({ value }: { value: number }) {
      const { value: current, count } = Local.use({ value });
      return <span>{current}:{count}</span>;
    }

    class Owner extends Component {
      value = 1;

      render() {
        return <Value value={this.value} />;
      }
    }

    let owner!: Owner;
    const root = document.createElement('main');
    const release = render(<Owner is={(value) => (owner = value)} />, root);

    expect(root.textContent).toBe('1:0');
    expect(lifecycle).toEqual(['new', 'mount']);

    owner.value = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('2:0');

    local.count = 3;
    await flushMicrotasks();
    expect(root.textContent).toBe('2:3');

    release();
    expect(lifecycle).toEqual(['new', 'mount', 'unmount']);
    expect(local.get(null)).toBe(true);
  });

  it('will call a State use method on every render', async () => {
    const calls: number[] = [];

    class Selection extends State {
      selected = 0;

      use(selected: number) {
        calls.push(selected);
        this.selected = selected;
      }
    }

    function Selected({ value }: { value: number }) {
      return <span>{Selection.use(value).selected}</span>;
    }

    class Owner extends Component {
      value = 1;
      render() {
        return <Selected value={this.value} />;
      }
    }

    let owner!: Owner;
    const root = document.createElement('main');
    render(<Owner is={(value) => (owner = value)} />, root);
    owner.value = 2;
    await flushMicrotasks();

    expect(root.textContent).toBe('2');
    expect(calls).toEqual([1, 2, 2]);
  });

  it('will pass context through functions and Consumers', async () => {
    class Session extends State {
      name = 'Ada';
    }

    let session!: Session;
    const root = document.createElement('main');
    const release = render(
      <Provider for={Session} is={(value) => (session = value)}>
        <Consumer for={Session}>{(value: Session) => <span>{value.name}</span>}</Consumer>
      </Provider>,
      root
    );

    expect(root.textContent).toBe('Ada');
    session.name = 'Grace';
    await flushMicrotasks();
    expect(root.textContent).toBe('Grace');

    release();
    expect(session.get(null)).toBe(true);
  });

  it('will reject render APIs outside their valid scope', () => {
    class Value extends State {}
    class View extends Component {
      render() {
        Value.use();
        return null;
      }
    }

    expect(() => Value.get()).toThrow('may only run while @expressive/dom is rendering');
    expect(() => Value.use()).toThrow('may only run while @expressive/dom is rendering');
    expect(() => (View as any).use()).toThrow('render it instead of calling use()');
    expect(() => render(<View />, document.createElement('main'))).toThrow(
      'only available at the top level of a function component'
    );
  });

  it('will support optional, required and selected context snapshots', async () => {
    class Missing extends State {}
    class Source extends State {
      value = 1;
      pending?: string;
    }

    let refresh!: State.ForceRefresh;
    let renders = 0;

    function View() {
      renders++;
      const missing = Missing.get(false);
      const selected = Source.get(({ value }, force) => {
        refresh = force;
        return value * 2;
      });
      const empty = Source.get(() => undefined);
      return <span>{String(missing)}:{selected}:{String(empty)}</span>;
    }

    const source = Source.new();
    const root = document.createElement('main');
    const release = render(
      <Provider for={source}><View /></Provider>,
      root
    );

    expect(root.textContent).toBe('undefined:2:null');
    refresh();
    await flushMicrotasks();
    await refresh(Promise.resolve());
    await refresh(() => Promise.resolve());
    await flushMicrotasks();
    expect(renders).toBeGreaterThan(1);

    release();
    source.set(null);

    class Required extends Component {
      render() {
        return <span>{Source.get(true).pending}</span>;
      }
    }

    const required = Source.new();
    expect(() => render(
      <Provider for={required}><Required fallback={false} /></Provider>,
      document.createElement('main')
    )).toThrow();
    required.set(null);
  });

  it('will enforce stable State.use order', () => {
    class First extends State {}
    class Second extends State {}
    const context = new Context(Context.root);
    const scope: Scope = {
      active: true,
      childContext: context,
      context,
      kind: 'function',
      subscriptions: [],
      update() {},
      useIndex: 0,
      uses: []
    };

    enter(scope, () => First.use());
    commit(scope);

    expect(() => enter(scope, () => null)).toThrow('same order');
    expect(() => enter(scope, () => Second.use())).toThrow('same order');

    dispose(scope);
    context.pop();
  });

  it('will turn capitalized methods and fields into owner-bound subcomponents', async () => {
    class Panel extends Component {
      value = 'one';
      Heading = function (this: Panel, { suffix }: { suffix: string }) {
        return <h1>{this.value}{suffix}</h1>;
      };
      NotAFunction = 1;

      helper() {}

      Label({ suffix }: { suffix: string }) {
        return <span>{this.value}{suffix}</span>;
      }

      Footer() {
        return <footer>original</footer>;
      }

      new() {
        (this as any).Footer = function (this: Panel) {
          return <footer>{this.value}</footer>;
        };
      }

      render() {
        const { Footer, Heading, Label } = this;
        return <>{<Heading suffix="!" />}{<Label suffix="?" />}{<Footer />}</>;
      }
    }

    let panel!: Panel;
    const root = document.createElement('main');
    render(<Panel is={(value) => (panel = value)} />, root);
    expect(root.textContent).toBe('one!one?one');

    panel.value = 'two';
    await flushMicrotasks();
    expect(root.textContent).toBe('two!two?two');
    expect(typeof panel.Label).toBe('function');

    (panel as any).Label = function () {
      return <span>{this.value}:override</span>;
    };
    panel.value = 'three';
    await flushMicrotasks();
    expect(root.textContent).toBe('three!three:overridethree');
  });

  it('will mount and release states owned by a Provider', async () => {
    const lifecycle: string[] = [];

    class Owned extends State {
      value = 0;
      mount() {
        lifecycle.push('mount');
        return () => lifecycle.push('unmount');
      }
    }

    class External extends State {}

    function Value() {
      return <span>{Owned.get().value}</span>;
    }

    class App extends Component {
      value = 1;
      render() {
        return (
          <Provider for={{ owned: Owned, external }}>
            <Provider for={Owned} value={this.value}><Value /></Provider>
            <Provider for={external}><small>{this.value}</small></Provider>
          </Provider>
        );
      }
    }

    const external = External.new();
    let app!: App;
    const root = document.createElement('main');
    const release = render(<App is={(value) => (app = value)} />, root);
    expect(root.textContent).toBe('11');
    expect(lifecycle).toEqual(['mount', 'mount']);

    app.value = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('22');

    release();
    expect(lifecycle).toEqual(['mount', 'mount', 'unmount', 'unmount']);
    expect(external.get(null)).toBe(false);
    external.set(null);
  });

  it('will transfer Provider lifecycle when its State type changes', async () => {
    const lifecycle: string[] = [];

    class First extends State {
      mount() {
        lifecycle.push('first:mount');
        return () => lifecycle.push('first:unmount');
      }
    }

    class Second extends State {
      mount() {
        lifecycle.push('second:mount');
        return () => lifecycle.push('second:unmount');
      }
    }

    class App extends Component {
      second = false;

      render() {
        const Type = this.second ? Second : First;
        return <Provider for={Type} />;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    const release = render(<App is={(value) => (app = value)} />, root);
    expect(lifecycle).toEqual(['first:mount']);

    app.second = true;
    await flushMicrotasks();
    expect(lifecycle).toEqual([
      'first:mount',
      'first:unmount',
      'second:mount'
    ]);

    release();
    expect(lifecycle).toEqual([
      'first:mount',
      'first:unmount',
      'second:mount',
      'second:unmount'
    ]);
  });

  it('will mount State.use after suspended content commits', async () => {
    const waiting = mockPromise<void>();
    const lifecycle: string[] = [];
    let ready = false;

    class Local extends State {
      mount() {
        lifecycle.push('mount');
        return () => lifecycle.push('unmount');
      }
    }

    function Content() {
      Local.use();
      if (!ready) throw waiting;
      return <p>ready</p>;
    }

    class App extends Component {
      fallback = <i>loading</i>;

      render() {
        return <Content />;
      }
    }

    const root = document.createElement('main');
    const release = render(<App />, root);
    expect(root.textContent).toBe('loading');
    expect(lifecycle).toEqual([]);

    ready = true;
    waiting.resolve();
    await flushMicrotasks();
    expect(root.textContent).toBe('ready');
    expect(lifecycle).toEqual(['mount']);

    release();
    expect(lifecycle).toEqual(['mount', 'unmount']);
  });

  it('will reserve Provider execution for the renderer', () => {
    expect(() => (Provider as any)({})).toThrow('must be rendered');
  });
});
