import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Model, Component, Context } from '@expressive/mvc';
import { render } from '../index';
import * as hot from '@expressive/mvc/hot';
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
      <Component for={Session} is={(value: Session) => void (session = value)}>
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

  it('will reject Model.get outside render', () => {
    class Value extends Model {}

    expect(() => Value.get()).toThrow('may only run while @expressive/dom is rendering');
  });

  it('will not accept a function', () => {
    class Value extends Model {
      value = 1;
    }

    expectTypeOf(Value.get).toBeCallableWith(false);
    // @ts-expect-error
    expectTypeOf(Value.get).toBeCallableWith(($: Value) => $.value);
  });

  it('will not accept true', () => {
    class Value extends Model {}

    // @ts-expect-error
    expectTypeOf(Value.get).toBeCallableWith(true);
  });

  it('will not provide Model.use', () => {
    class Value extends Model {}

    expect((Value as any).use).toBeUndefined();
  });

  it('will support optional context snapshots', async () => {
    class Missing extends Model {}
    class Source extends Model {
      value = 1;
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
    source.value = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('undefined:2');

    release();
    source.set(null);
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
          <Component for={Session} name={this.value} is={(s: Session) => void (session = s)}>
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
      <Component for={Typed} name="Ada" is={(typed) => void typed.age.toFixed()} />,
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

describe('get parity', () => {
  class Foo extends Model {
    value = 'none';
  }

  it('will follow a provider replaced by parent render', async () => {
    const a = Foo.new({ value: 'a' });
    const b = Foo.new({ value: 'b' });
    const renders = vi.fn();

    function Name() {
      renders();
      return <span>{Foo.get().value}</span>;
    }

    class Stable extends Component {
      render() {
        renders();
        return <span>{Foo.get().value}</span>;
      }
    }

    class App extends Component {
      current = a;

      render() {
        return (
          <Component for={this.current}>
            <Name />
            <Stable />
          </Component>
        );
      }
    }

    const [app, root, release] = mount(App);

    expect(root.textContent).toBe('aa');

    app.current = b;
    await flushMicrotasks();

    expect(root.textContent).toBe('bb');

    renders.mockClear();
    a.value = 'stale';
    await flushMicrotasks();

    expect(renders).not.toBeCalled();

    release();
  });

  it('will follow an implicitly replaced child', async () => {
    class Parent extends Model {
      child = new Foo({ value: 'original' });
    }

    const parent = Parent.new();
    const renders = vi.fn();

    function Name() {
      renders();
      return <span>{Foo.get().value}</span>;
    }

    const root = document.createElement('main');
    const release = render(<Component for={parent}><Name /></Component>, root);

    expect(root.textContent).toBe('original');

    parent.child = new Foo({ value: 'replaced' });
    await flushMicrotasks();

    expect(root.textContent).toBe('replaced');

    parent.child.value = 'updated';
    await flushMicrotasks();

    expect(root.textContent).toBe('updated');

    release();
  });

  it('will refresh for an instance arriving after mount', async () => {
    class Parent extends Model {
      child?: Foo = undefined;
    }

    const parent = Parent.new();

    function Name() {
      return <span>{Foo.get(false)?.value ?? 'missing'}</span>;
    }

    const root = document.createElement('main');
    const release = render(<Component for={parent}><Name /></Component>, root);

    expect(root.textContent).toBe('missing');

    parent.child = new Foo({ value: 'arrived' });
    await flushMicrotasks();

    expect(root.textContent).toBe('arrived');

    release();
  });

  it('will refresh for a provider whose for becomes defined', async () => {
    class App extends Component {
      current?: Foo = undefined;

      render() {
        return (
          <Component for={this.current}>
            <Name />
          </Component>
        );
      }
    }

    function Name() {
      return <span>{Foo.get(false)?.value ?? 'missing'}</span>;
    }

    const [app, root, release] = mount(App);

    expect(root.textContent).toBe('missing');

    app.current = Foo.new({ value: 'arrived' });
    await flushMicrotasks();

    expect(root.textContent).toBe('arrived');

    release();
  });

  it('will return undefined when the provider is removed', async () => {
    class Parent extends Model {
      child?: Foo = new Foo({ value: 'present' });
    }

    const parent = Parent.new();
    const found = vi.fn();

    function Name() {
      const foo = Foo.get(false);
      found(foo);
      return <span>{foo?.value ?? 'missing'}</span>;
    }

    const root = document.createElement('main');
    const release = render(<Component for={parent}><Name /></Component>, root);

    expect(root.textContent).toBe('present');

    parent.child = undefined;
    await flushMicrotasks();

    expect(root.textContent).toBe('missing');
    expect(found).toHaveBeenLastCalledWith(undefined);

    release();
  });

  it('will throw when a required provider is removed', async () => {
    class Parent extends Model {
      child?: Foo = new Foo({ value: 'present' });
    }

    const parent = Parent.new();

    function Name() {
      try {
        return <span>{Foo.get().value}</span>;
      } catch (err: any) {
        return <span>{err.message}</span>;
      }
    }

    const root = document.createElement('main');
    const release = render(<Component for={parent}><Name /></Component>, root);

    expect(root.textContent).toBe('present');

    parent.child = undefined;
    await flushMicrotasks();

    expect(root.textContent).toBe(`Could not find ${Foo} in context.`);

    release();
  });

  it('will not refresh for a provider above the one found', async () => {
    class Parent extends Model {
      child = new Foo({ value: 'near' });
    }

    const parent = Parent.new();
    const renders = vi.fn();

    function Name() {
      renders();
      return <span>{Foo.get().value}</span>;
    }

    const root = document.createElement('main');
    const release = render(<Component for={parent}><Name /></Component>, root);

    const remove = Context.root.add(Foo.new({ value: 'far' }));
    await flushMicrotasks();

    expect(root.textContent).toBe('near');
    expect(renders).toBeCalledTimes(1);

    remove();
    release();
  });
});
