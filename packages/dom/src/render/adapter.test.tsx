import { describe, expect, it, vi } from 'vitest';

import { Model, Component, Context } from '@expressive/mvc';
import { render } from '../index';
import * as hot from '@expressive/mvc/hot';
import { observer } from '@expressive/mvc/observable';
import { flushMicrotasks, mockPromise, mount } from '../../test.setup';

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

  it('will read root context outside render', () => {
    class Value extends Model {}

    expect(Context.get()).toBe(Context.root);
    expect(() => Value.get()).toThrow('Could not find Value in context.');
    expect(Value.get(false)).toBeUndefined();
  });

  it('will not provide Model.use', () => {
    class Value extends Model {}

    expect((Value as any).use).toBeUndefined();
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

  it('will share one subscription between plain and strict reads', async () => {
    class Source extends Model {
      value = 1;
    }

    const renders = vi.fn();
    const added: number[] = [];

    function View() {
      renders();
      const { listeners } = observer(source)!;
      const { value } = Source.get();
      const before = listeners.size;
      const strict = Source.get(true);
      added.push(listeners.size - before);
      return <span>{value}:{strict.value}</span>;
    }

    const source = Source.new();
    const root = document.createElement('main');
    const release = render(<Component for={source}><View /></Component>, root);

    source.value = 2;
    await flushMicrotasks();

    expect(root.textContent).toBe('2:2');
    expect(renders).toHaveBeenCalledTimes(2);
    expect(added).toEqual([0, 0]);

    release();
    source.set(null);
  });

  it('will keep get(true) strict through an override delegating to super', () => {
    class Source extends Model {
      id = 0;
      pending?: string = undefined;

      static get<T extends Source>(this: Model.Extends<T>, id?: T['id'] | boolean): T {
        if (typeof id != 'number') return super.get(id as never) as T;

        return Context.get(this, (context) => context.get(this));
      }
    }

    function View() {
      return <span>{Source.get(true).pending}</span>;
    }

    const source = Source.new();

    expect(() => render(
      <Component for={source}><View /></Component>,
      document.createElement('main')
    )).toThrow(/\.pending is required in this context\./);

    source.set(null);
  });

  it('will return render context from bare Context.get', () => {
    class Source extends Model {}

    let context!: Context;

    function View() {
      context = Context.get();
      return null;
    }

    const source = Source.new();
    const release = render(
      <Component for={source}><View /></Component>,
      document.createElement('main')
    );

    expect(context).not.toBe(Context.root);
    expect(context.get(Source)).toBe(source);

    release();
    source.set(null);
  });

  it('will return a computed value untracked', () => {
    class Source extends Model {
      value = 1;
    }

    let result: unknown;

    function View() {
      result = Context.get(Source, (context) => context.get(Source).value);
      return null;
    }

    const source = Source.new();
    const release = render(
      <Component for={source}><View /></Component>,
      document.createElement('main')
    );

    expect(result).toBe(1);

    release();
    source.set(null);
  });

  it('will forward to core within Context.set', async () => {
    class Source extends Model {
      value = 1;
    }

    const outer = Source.new();
    const inner = Source.new();
    const context = new Context(inner);
    const renders = vi.fn();
    let found: Source | undefined;

    function View() {
      renders();
      found = Context.set(context, () => Source.get());
      return null;
    }

    const release = render(
      <Component for={outer}><View /></Component>,
      document.createElement('main')
    );

    expect(found).toBe(inner);

    inner.value = 2;
    await flushMicrotasks();

    expect(renders).toHaveBeenCalledOnce();

    release();
    outer.set(null);
    inner.set(null);
  });

  it('will not cache a throw', () => {
    class Source extends Model {}

    let ready = false;
    const results: unknown[] = [];

    class Lookup extends Model {
      static get(): any {
        return Context.get(this, (context) => {
          if (!ready) throw new Error('not ready');
          return context.get(Source);
        });
      }
    }

    function View() {
      try {
        Lookup.get();
      } catch (error) {
        results.push(error);
      }

      ready = true;
      results.push(Lookup.get());
      return null;
    }

    const source = Source.new();
    const release = render(
      <Component for={source}><View /></Component>,
      document.createElement('main')
    );

    expect(results[0]).toEqual(new Error('not ready'));
    expect((results[1] as Source).is).toBe(source);

    release();
    source.set(null);
  });

  it('will track an override and follow a changed key', async () => {
    class Item extends Model {
      id = 0;
      label = '';

      static get<T extends Item>(this: Model.Extends<T>, id?: T['id'] | false): T {
        return Context.get(this, (context) => {
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

    class App extends Component {
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

    class Wait extends Component {
      fallback = false as const;
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
