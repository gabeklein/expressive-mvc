import { describe, expect, it, vi } from 'vitest';

import { Model, Component } from '@expressive/mvc';
import { render } from '../index';
import { Context } from '@expressive/mvc';
import { getter } from '@expressive/mvc/getter';
import { commit, dispose, enter } from './adapter';
import type { Scope } from './adapter';
import * as hot from '@expressive/mvc/hot';
import { flushMicrotasks, mockPromise, mount, place } from '../../test.setup';

describe('MVC adapter', () => {
  it('will update when a Model fetched via this.get changes', async () => {
    class Auth extends Model {
      static readonly global = true;
      name = 'foo';
    }

    class View extends Component {
      render() {
        return <span>{this.get(Auth).name}</span>;
      }
    }

    const auth = Auth.new();
    const [, root, release] = mount(View);

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

    const [counter, root, release] = mount(Counter);

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

  it('will own Model.use within a stable function-component slot', async () => {
    const lifecycle: string[] = [];
    let local!: Local;

    class Local extends Model {
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

    const [owner, root, release] = mount(Owner);

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

  it('will provide a Model.use instance to descendants', async () => {
    class Session extends Model {
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

    const root = place(<><Host /><Sibling /></>);
    expect(root.textContent).toBe('Adanone');

    session.name = 'Grace';
    await flushMicrotasks();
    expect(root.textContent).toBe('Gracenone');
  });

  it('will call a Model use method on every render', async () => {
    const calls: number[] = [];

    class Selection extends Model {
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

    const [owner, root] = mount(Owner);
    owner.value = 2;
    await flushMicrotasks();

    expect(root.textContent).toBe('2');
    expect(calls).toEqual([1, 2, 2]);
  });

  it('will pass context through functions', async () => {
    class Session extends Model {
      name = 'Ada';
    }

    function Name() {
      const { name } = Session.get();
      return <span>{name}</span>;
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
    class Value extends Model {}
    class View extends Component {
      render() {
        Value.use();
        return null;
      }
    }

    expect(() => Value.get()).toThrow('Could not find Value in context.');
    expect(Value.get(false)).toBeUndefined();
    expect(() => Value.use()).toThrow('may only run while @expressive/dom is rendering');
    expect(() => (View as any).use()).toThrow('render it instead of calling use()');
    expect(() => render(<View />, document.createElement('main'))).toThrow(
      'only available at the top level of a function component'
    );
  });

  it('will support optional and required context lookups', async () => {
    class Missing extends Model {}
    class Source extends Model {
      value = 1;
      pending?: string;
    }

    function View() {
      const missing = Missing.get(false);
      const { value } = Source.get();
      return <span>{String(missing)}:{value}</span>;
    }

    const source = Source.new();
    const root = document.createElement('main');
    const release = render(
      <Component for={source}><View /></Component>,
      root
    );

    expect(root.textContent).toBe('undefined:1');

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

  it('will return one tracked proxy per instance in a render', () => {
    class Source extends Model {
      value = 1;
    }

    const proxies: Source[] = [];

    function View() {
      proxies.push(Source.get(), Source.get(), Source.get(true));
      return null;
    }

    const source = Source.new();
    const release = render(
      <Component for={source}><View /></Component>,
      document.createElement('main')
    );

    const [first, second, required] = proxies;

    expect(first).toBe(second);
    expect(first).not.toBe(source);
    expect(required).not.toBe(first);
    expect(required.is).toBe(source);

    release();
    source.set(null);
  });

  it('will track an override and follow a changed key', async () => {
    class Item extends Model {
      id = 0;
      label = '';

      static get<T extends Item>(this: Model.Extends<T>, id?: T['id'] | false): T {
        return getter(this, (context) => {
          const { a, b } = context.get(Store);
          return [a, b].find((item) => item.id === id) as T;
        });
      }
    }

    class Store extends Model {
      a = new Item({ id: 1, label: 'one' });
      b = new Item({ id: 2, label: 'two' });
    }

    class Picker extends Model {
      selected = 1;
    }

    const renders = vi.fn();

    function View() {
      renders();
      const { selected } = Picker.get();
      const { label } = Item.get(selected);
      return <span>{label}</span>;
    }

    const store = Store.new();
    const picker = Picker.new();
    const root = document.createElement('main');
    const release = render(
      <Component for={store}>
        <Component for={picker}>
          <View />
        </Component>
      </Component>,
      root
    );

    expect(root.textContent).toBe('one');

    store.a.label = 'uno';
    await flushMicrotasks();
    expect(root.textContent).toBe('uno');

    picker.selected = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('two');
    expect(renders).toBeCalledTimes(3);

    store.a.label = 'one';
    await flushMicrotasks();
    expect(renders).toBeCalledTimes(3);

    store.b.label = 'dos';
    await flushMicrotasks();
    expect(root.textContent).toBe('dos');

    release();
    store.set(null);
    picker.set(null);
  });

  it('will enforce stable Model.use order', () => {
    class First extends Model {}
    class Second extends Model {}
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

    const [panel, root] = mount(Panel);
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
    class Store extends Model {
      Parse(text: string) {
        return text.toUpperCase();
      }
    }

    const store = Store.new();
    expect(store.Parse('x')).toBe('X');
  });

  it('will track the owner of a subcomponent rendered elsewhere', async () => {
    class Row extends Model {
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

    const [table, root] = mount(Table);
    expect(root.textContent).toBe('aa');

    table.row.label = 'b';
    await flushMicrotasks();
    expect(root.textContent).toBe('bb');
  });

  it('will not treat subcomponents of different owners as one', async () => {
    class Row extends Model {
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

    const [table, root] = mount(Table);
    expect(root.textContent).toBe('a');

    table.pick = 1;
    await flushMicrotasks();
    expect(root.textContent).toBe('b');

    table.pick = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('plain');
  });

  it('will mount Model.use after suspended content commits', async () => {
    const waiting = mockPromise<void>();
    const lifecycle: string[] = [];
    let ready = false;

    class Local extends Model {
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
  class Session extends Model {
    name = 'none';
  }

  function Name() {
    return <b>{Session.get().name}</b>;
  }

  it('will construct, provide and forward props to a class', async () => {
    let session!: Session;

    class App extends Model {
      value = 'Ada';

      render() {
        return (
          <Component for={Session} name={this.value} is={(s: Session) => (session = s)}>
            <Name />
          </Component>
        );
      }
    }

    const [app, root, release] = mount(App);
    expect(root.textContent).toBe('Ada');

    app.value = 'Grace';
    await flushMicrotasks();
    expect(root.textContent).toBe('Grace');

    release();
    expect(session.get(null)).toBe(true);
  });

  it('will not add a suspense boundary', () => {
    const gate = mockPromise<void>();

    class Wait extends Model {
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

  it('will type attributes from for', () => {
    class Typed extends Model {
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
});
