import { describe, expect, it, vi } from 'vitest';

import { State, Component } from '@expressive/mvc';
import { render } from './index';
import { Context } from '@expressive/mvc';
import { commit, dispose, enter } from './adapter';
import type { Scope } from './adapter';
import * as hot from '@expressive/mvc/hot';
import { flushMicrotasks, mockPromise } from '../test.setup';

describe('MVC adapter', () => {
  it('will update when a State fetched via this.get changes', async () => {
    class Auth extends State {
      static readonly global = true;
      name = 'foo';
    }

    class View extends Component {
      render() {
        return <span>{this.get(Auth).name}</span>;
      }
    }

    const auth = Auth.new();
    const root = document.createElement('main');
    const release = render(<View />, root);

    expect(root.textContent).toBe('foo');

    auth.name = 'bar';
    await expect(auth).toHaveUpdated();
    await Promise.resolve();

    expect(root.textContent).toBe('bar');

    release();
    auth.set(null);
  });

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

  it('will provide a State.use instance to descendants', async () => {
    class Session extends State {
      name = 'Ada';
    }

    let session!: Session;

    function Leaf() {
      return <b>{Session.get().name}</b>;
    }

    function Sibling() {
      return <i>{Session.get(false) ? 'leak' : 'none'}</i>;
    }

    function Host() {
      session = Session.use();
      return <Leaf />;
    }

    const root = document.createElement('main');
    render(<><Host /><Sibling /></>, root);
    expect(root.textContent).toBe('Adanone');

    session.name = 'Grace';
    await flushMicrotasks();
    expect(root.textContent).toBe('Gracenone');
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

  it('will pass context through functions', async () => {
    class Session extends State {
      name = 'Ada';
    }

    function Name() {
      return Session.get((value) => <span>{value.name}</span>);
    }

    let session!: Session;
    const root = document.createElement('main');
    const release = render(
      <Component for={Session} is={(value: Session) => (session = value)}>
        <Name />
      </Component>,
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
      <Component for={source}><View /></Component>,
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
      <Component for={required}><Required fallback={false} /></Component>,
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

  it('will render capitalized methods as owner-bound subcomponents', async () => {
    class Panel extends Component {
      value = 'one';

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
        const { Footer, Label } = this;
        return <><Label suffix="?" /><Footer /></>;
      }
    }

    let panel!: Panel;
    const root = document.createElement('main');
    render(<Panel is={(value) => (panel = value)} />, root);
    expect(root.textContent).toBe('one?one');

    panel.value = 'two';
    await flushMicrotasks();
    expect(root.textContent).toBe('two?two');

    panel.set({
      Label(this: Panel) {
        return <span>{this.value}:override</span>;
      }
    } as never);
    panel.value = 'three';
    await flushMicrotasks();
    expect(root.textContent).toBe('three:overridethree');
  });

  it('will leave capitalized methods callable outside render', () => {
    class Store extends State {
      Parse(text: string) {
        return text.toUpperCase();
      }
    }

    const store = Store.new();
    expect(store.Parse('x')).toBe('X');
  });

  it('will track the owner of a subcomponent rendered elsewhere', async () => {
    class Row extends State {
      label = 'a';

      Cell() {
        return <i>{this.label}</i>;
      }
    }

    function Slot({ Cell }: { Cell: () => Component.Node }) {
      return <Cell />;
    }

    class Table extends Component {
      row = new Row();

      render() {
        return <><this.row.Cell /><Slot Cell={this.row.Cell} /></>;
      }
    }

    let table!: Table;
    const root = document.createElement('main');
    render(<Table is={(value) => (table = value)} />, root);
    expect(root.textContent).toBe('aa');

    table.row.label = 'b';
    await flushMicrotasks();
    expect(root.textContent).toBe('bb');
  });

  it('will not treat subcomponents of different owners as one', async () => {
    class Row extends State {
      label: string;

      constructor(label: string) {
        super();
        this.label = label;
      }

      Cell() {
        return <i>{this.label}</i>;
      }
    }

    const Plain = () => <i>plain</i>;

    class Table extends Component {
      first = new Row('a');
      second = new Row('b');
      pick = 0;

      render() {
        const { pick, first, second } = this;
        const Cell = pick == 0 ? first.Cell : pick == 1 ? second.Cell : Plain;
        return <Cell />;
      }
    }

    let table!: Table;
    const root = document.createElement('main');
    render(<Table is={(value) => (table = value)} />, root);
    expect(root.textContent).toBe('a');

    table.pick = 1;
    await flushMicrotasks();
    expect(root.textContent).toBe('b');

    table.pick = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('plain');
  });

  it('will transfer Component for lifecycle when its State type changes', async () => {
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
        return <Component for={Type} />;
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
});

describe('hot patch', () => {
  const version = (text: string) => {
    class Panel extends Component {
      value = 1;

      Label() {
        return <b>{text}</b>;
      }

      render() {
        const { value, Label } = this;
        return <><Label />{value}</>;
      }
    }
    return Panel;
  };

  it('will patch a subcomponent in place', async () => {
    const Panel = version('before');
    const root = document.createElement('main');

    hot.accept('dom-subcomponent-live', { Panel });
    render(<Panel />, root);

    expect(root.textContent).toBe('before1');

    hot.accept('dom-subcomponent-live', { Panel: version('after') });
    await flushMicrotasks();

    expect(root.textContent).toBe('after1');
  });

  it('will patch a subcomponent for new instances', () => {
    const Panel = version('before');
    const root = document.createElement('main');

    hot.accept('dom-subcomponent-new', { Panel });
    render(<Panel />, root)();
    hot.accept('dom-subcomponent-new', { Panel: version('after') });
    render(<Panel />, root);

    expect(root.textContent).toBe('after1');
  });
});

describe('Component for', () => {
  class Session extends State {
    name = 'none';
  }

  function Name() {
    return <b>{Session.get().name}</b>;
  }

  it('will construct, own and provide a class', async () => {
    let session!: Session;
    const root = document.createElement('main');
    const done = render(
      <Component for={Session} name="Ada" is={(s: Session) => (session = s)}>
        <Name />
      </Component>,
      root
    );

    expect(root.textContent).toBe('Ada');

    done();

    expect(session.get(null)).toBe(true);
  });

  it('will provide an instance and forward props on update', async () => {
    const session = Session.new();

    class App extends State {
      value = 'Ada';

      render() {
        return (
          <Component for={session} name={this.value}>
            <Name />
          </Component>
        );
      }
    }

    let app!: App;
    const root = document.createElement('main');
    const done = render(<App is={(a) => (app = a)} />, root);

    expect(root.textContent).toBe('Ada');

    app.value = 'Grace';
    await flushMicrotasks();
    await flushMicrotasks();

    expect(session.name).toBe('Grace');
    expect(root.textContent).toBe('Grace');

    done();

    expect(session.get(null)).toBe(false);
  });

  it('will mount a class it constructed', () => {
    const mounted = vi.fn();
    const released = vi.fn();

    class Owned extends State {
      mount() {
        mounted();
        return released;
      }
    }

    const done = render(<Component for={Owned} />, document.createElement('main'));

    expect(mounted).toBeCalledTimes(1);

    done();

    expect(released).toBeCalledTimes(1);
  });

  it('will replace an instance made each render', async () => {
    const made: Session[] = [];

    class App extends State {
      n = 0;

      render() {
        const session = new Session();
        made.push(session);
        return <Component for={session} name={String(this.n)}><Name /></Component>;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    const done = render(<App is={(a) => (app = a)} />, root);

    app.n = 1;
    await flushMicrotasks();

    expect(made).toHaveLength(2);
    expect(made[0].get(null)).toBe(true);
    expect(made[1].get(null)).toBe(false);
    expect(root.textContent).toBe('1');

    done();

    expect(made[1].get(null)).toBe(true);
  });

  it('will type attributes from for', () => {
    class Typed extends State {
      name = '';
      age = 0;
    }

    class Sub extends Component {}

    void (() => [
      <Component for={Typed} name="Ada" is={(typed) => typed.age.toFixed()} />,
      <Component for={Typed.new()} age={2} />,
      <Component fallback={null} />,
      // @ts-expect-error
      <Component for={Typed} name={1} />,
      // @ts-expect-error
      <Component for={Typed} nope="x" />,
      // @ts-expect-error
      <Component for={Typed.new()} is={() => {}} />,
      // @ts-expect-error
      <Sub for={Typed} />
    ]);
  });

  it('will not add a suspense boundary', async () => {
    const gate = mockPromise<void>();

    class Wait extends State {
      ready = false;

      render() {
        if (!this.ready) throw gate;
        return <i>ready</i>;
      }
    }

    const root = document.createElement('main');

    render(
      <Component fallback={<i>outer</i>}>
        <Component for={Session}>
          <Wait />
        </Component>
      </Component>,
      root
    );

    expect(root.textContent).toBe('outer');
  });
});
