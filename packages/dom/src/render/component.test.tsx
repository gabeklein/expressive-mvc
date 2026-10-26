import { describe, expect, it, vi } from 'vitest';

import { Component, Model, has } from '@expressive/mvc';
import { render } from '../index';
import { flushMicrotasks, mockPromise, mount, place } from '../../test.setup';

describe('component', () => {
  it('will retain a class Component when its VNode props object is unchanged', async () => {
    class Child extends Component {
      label = '';
      render() {
        return <span>{this.label}</span>;
      }
    }

    const child = <Child label="fixed" />;

    class Parent extends Component {
      tick = 0;
      render() {
        this.tick;
        return child;
      }
    }

    const [parent, root] = mount(Parent);
    const span = root.querySelector('span');
    parent.tick++;
    await flushMicrotasks();

    expect(root.querySelector('span')).toBe(span);
  });

  it('will place an external Component and collection without owning them', async () => {
    const cleanup = vi.fn();

    class Message extends Component {
      mount() {
        return cleanup;
      }

      render() {
        return <span>message</span>;
      }
    }

    const message = Message.new();
    const first = new has.List(['first']);
    const second = new has.List(['second']);

    class Parent extends Component {
      tick = 0;
      useSecond = false;

      render() {
        return <><small>{this.tick}</small>{message}{this.useSecond ? second : first}</>;
      }
    }

    const [parent, root, release] = mount(Parent);
    parent.tick++;
    await flushMicrotasks();
    expect(root.textContent).toBe('1messagefirst');

    parent.useSecond = true;
    await flushMicrotasks();
    expect(root.textContent).toBe('1messagesecond');

    release();
    expect(message.get(null)).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();
    message.set(null);
  });
});

describe('class element', () => {
  it('will pass children through a Component without render', () => {
    class Bare extends Component {}
    const root = document.createElement('main');

    render(<div><Bare>text</Bare><Bare /></div>, root);
    expect(root.textContent).toBe('text');
  });

  it('will be owned by enclosing Component', () => {
    let inner!: Component;

    class Panel extends Component {
      render() {
        return null;
      }
    }

    class Outer extends Component {
      render() {
        return <Panel is={(panel) => void (inner = panel)} />;
      }
    }

    const [outer] = mount(Outer);

    expect(outer.get(Model, false)).toBeUndefined();
    expect(inner.get(Model)).toBe(outer);
  });

  it('will render a Component with a render method', async () => {
    const lifecycle: string[] = [];
    let panel!: Panel;

    class Panel extends Component {
      label = 'idle';
      count = 0;

      mount() {
        lifecycle.push('mount');
        return () => lifecycle.push('unmount');
      }

      render() {
        return <span>{this.label}:{this.count}</span>;
      }
    }

    const root = document.createElement('main');
    const release = render(<Panel label="busy" is={(value) => void (panel = value)} />, root);

    expect(root.textContent).toBe('busy:0');
    expect(lifecycle).toEqual(['mount']);

    panel.count = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('busy:2');

    release();
    expect(lifecycle).toEqual(['mount', 'unmount']);
    expect(panel.get(null)).toBe(true);
  });

  it('will apply props to fields, reset dropped ones and pass the rest to render', async () => {
    class Panel extends Component {
      label?: string = 'default';

      render(props: { children?: Component.Node }) {
        return <b>{this.label ?? 'none'}{props.children}</b>;
      }
    }

    class App extends Component {
      label?: string = 'one';

      render() {
        return this.label ? <Panel label={this.label}>!</Panel> : <Panel>!</Panel>;
      }
    }

    const [app, root] = mount(App);
    expect(root.textContent).toBe('one!');

    app.label = 'two';
    await flushMicrotasks();
    expect(root.textContent).toBe('two!');

    app.label = undefined;
    await flushMicrotasks();
    expect(root.textContent).toBe('none!');
  });

  it('will provide a Model through Component for', async () => {
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

    const root = document.createElement('main');
    const release = render(
      <>
        <Component for={Session} name="Grace" is={(value: Session) => void (session = value)}>
          <Leaf />
        </Component>
        <Sibling />
      </>,
      root
    );

    expect(root.textContent).toBe('Gracenone');

    session.name = 'Hopper';
    await flushMicrotasks();
    expect(root.textContent).toBe('Hoppernone');

    release();
    expect(session.get(null)).toBe(true);
  });

  it('will not provide Component for itself', () => {
    class Session extends Model {}

    let outer!: Outer;
    let found: Component | undefined;

    function Probe() {
      found = Component.get();
      return null;
    }

    class Outer extends Component {
      render() {
        return (
          <Component for={Session}>
            <Probe />
          </Component>
        );
      }
    }

    [outer] = mount(Outer);

    expect(found!.is).toBe(outer.is);
  });

  it('will keep children of Component for mounted when for changes', async () => {
    class Base extends Model {}
    class First extends Base {}
    class Second extends Base {}

    const made: Child[] = [];

    class Child extends Component {
      new() {
        made.push(this);
      }
    }

    class Host extends Component {
      second = false;

      render() {
        return (
          <Component for={this.second ? Second : First}>
            <Child />
          </Component>
        );
      }
    }

    const [host] = mount(Host);

    host.second = true;
    await flushMicrotasks();

    expect(made).toHaveLength(1);
    expect(made[0].get(null)).toBe(false);
    expect(made[0].get(Base)).toBeInstanceOf(Second);
  });


  it('will render a Component instance inline', async () => {
    class Panel extends Component {
      label = 'inline';
      render() {
        return <span>{this.label}</span>;
      }
    }

    const panel = Panel.new();
    const root = place(<div>{panel}</div>);
    expect(root.textContent).toBe('inline');

    panel.label = 'changed';
    await flushMicrotasks();
    expect(root.textContent).toBe('changed');
    expect(panel.get(null)).toBe(false);
  });

  it('will own Components rendered by an instance placed inline', () => {
    let inner!: Component;

    class Inner extends Component {}
    class Slot extends Component {
      render() {
        return <Inner is={(i) => void (inner = i)} />;
      }
    }

    const instance = Slot.new();

    place(<div>{instance}</div>);

    expect(inner.get(Model)).toBe(instance);
  });

  it('will keep its own context after another placement is removed', async () => {
    function Value() {
      return <span>{Item.get().value}</span>;
    }

    class Item extends Component {
      value = 'a';
      show = false;

      render() {
        return this.show && <Value />;
      }
    }

    class Host extends Component {
      both = true;

      render() {
        return <>{this.both && <section>{instance}</section>}<aside>{instance}</aside></>;
      }
    }

    const instance = Item.new();
    const host = Host.new();
    const root = place(<div>{host}</div>);

    host.both = false;
    await flushMicrotasks();

    instance.show = true;
    await flushMicrotasks();

    expect(root.textContent).toBe('a');
  });

  describe('placed instance context', () => {
    class Theme extends Model {
      color = '';
    }

    class Child extends Model {
      name = '';
    }

    function Probe() {
      return <span>{Child.get().name} {Theme.get().color}</span>;
    }

    it('will resolve like a for provider', () => {
      class Slot extends Component {
        child = new Child({ name: 'held' });

        render() {
          return <Probe />;
        }
      }

      const placed = Slot.new();
      const provided = Slot.new();
      const root = place(
        <Component for={Theme} color="red">
          <Component for={Child} name="outer">
            <section>{placed}</section>
            <Component for={provided}>
              <aside><Probe /></aside>
            </Component>
          </Component>
        </Component>
      );

      expect(root.querySelector('section')!.textContent).toBe('held red');
      expect(root.querySelector('aside')!.textContent).toBe('held red');
    });

    it('will resolve each placement from its own ancestors', async () => {
      class Slot extends Component {
        child = new Child({ name: 'held' });
        show = false;

        render() {
          return this.show && <Probe />;
        }
      }

      const slot = Slot.new();
      const root = place(
        <>
          <Component for={Theme} color="red">
            <section>{slot}</section>
          </Component>
          <Component for={Theme} color="blue">
            <aside>{slot}</aside>
          </Component>
        </>
      );

      slot.show = true;
      await flushMicrotasks();

      expect(root.querySelector('section')!.textContent).toBe('held red');
      expect(root.querySelector('aside')!.textContent).toBe('held blue');
    });

    it('will not move its home', () => {
      class Slot extends Component {
        render() {
          return <Probe />;
        }
      }

      class Parent extends Model {
        child = new Child({ name: 'home' });
        slot = new Slot();
      }

      const parent = Parent.new();
      const root = place(
        <>
          <Component for={Theme} color="red">
            <Component for={parent} />
          </Component>
          <Component for={Theme} color="blue">
            <Component for={Child} name="outer">
              <section>{parent.slot}</section>
            </Component>
          </Component>
        </>
      );

      expect(root.querySelector('section')!.textContent).toBe('outer blue');
      expect(parent.slot.get(Child).name).toBe('home');
      expect(parent.slot.get(Theme).color).toBe('red');
    });

    it('will resolve a new placement after the first is removed', async () => {
      class Slot extends Component {
        child = new Child({ name: 'held' });

        render() {
          return <Probe />;
        }
      }

      const slot = Slot.new();
      const first = document.createElement('main');
      const release = render(
        <Component for={Theme} color="red">
          <section>{slot}</section>
        </Component>,
        first
      );

      expect(first.textContent).toBe('held red');

      release();

      const second = place(
        <Component for={Theme} color="blue">
          <section>{slot}</section>
        </Component>
      );

      expect(second.textContent).toBe('held blue');

      slot.child.name = 'next';
      await flushMicrotasks();

      expect(second.textContent).toBe('next blue');
    });
  });

  it('will own a boundary from a fallback on the element', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = () => loaded;

    class Plain extends Component {
      render() {
        return <Lazy />;
      }
    }

    const root = place(<Plain fallback={<i>loading</i>} />);
    expect(root.textContent).toBe('loading');

    loaded.resolve(() => <b>ready</b>);
    await flushMicrotasks();
    expect(root.textContent).toBe('ready');
  });

  it('will keep a Component which suspends itself', async () => {
    const loaded = mockPromise<void>();
    const created = vi.fn();
    let ready = false;

    class Report extends Component {
      count = 1;

      new() {
        created();
      }

      render() {
        if (!ready) throw loaded;
        return <p>{this.count}</p>;
      }
    }

    const [report, root] = mount(Report, { fallback: <i>loading</i> });
    expect(root.textContent).toBe('loading');

    report.count = 2;
    ready = true;
    loaded.resolve();
    await flushMicrotasks();

    expect(root.textContent).toBe('2');
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('will prefer an element fallback over the member, used when placed', () => {
    const Lazy = () => new Promise<never>(() => {});

    class Guarded extends Component {
      fallback: Component.Node = <i>member</i>;

      render() {
        return <Lazy />;
      }
    }

    const root = place(<Guarded fallback={<i>element</i>} />);
    expect(root.textContent).toBe('element');

    const other = place(<><Guarded /><div>{Guarded.new() as never}</div></>);
    expect(other.textContent).toBe('membermember');
  });

  it('will call an element catch with the error and instance', async () => {
    const caught = vi.fn();
    let plain!: Plain;

    class Plain extends Component {
      broken = true;

      render() {
        if (this.broken) throw new Error('broken');
        return <p>fixed</p>;
      }
    }

    const root = place(
      <Plain
        is={(value) => void (plain = value)}
        fallback={<i>recovering</i>}
        catch={(error: Error, instance: Plain) => {
          caught(error.message, instance);
          instance.broken = false;
        }}
      />
    );

    expect(caught).toHaveBeenCalledWith('broken', plain);
    expect(root.textContent).toBe('recovering');

    await flushMicrotasks();
    expect(root.textContent).toBe('fixed');
  });

  it('will not own a boundary from fallback on a function component', () => {
    const received = vi.fn();
    const Lazy = () => new Promise<never>(() => {});

    function View(props: { fallback?: string }) {
      received(props.fallback);
      return <Lazy />;
    }

    class Outer extends Component {
      fallback = <i>outer</i>;

      render() {
        return <View fallback="inner" />;
      }
    }

    const root = place(<Outer />);
    expect(received).toHaveBeenCalledWith('inner');
    expect(root.textContent).toBe('outer');
  });

  it('will render a PascalCase function field as a plain function component', async () => {
    const First = ({ text }: { text: string }) => <b>{text}</b>;
    const Second = ({ text }: { text: string }) => <i>{text}</i>;

    class Panel extends Component {
      Badge = First;

      render() {
        return <this.Badge text="x" />;
      }
    }

    const [panel, root] = mount(Panel);
    expect(root.querySelector('b')?.textContent).toBe('x');
    expect(panel.Badge).toBe(First);

    panel.Badge = Second;
    await flushMicrotasks();
    expect(root.querySelector('i')?.textContent).toBe('x');
  });

  it('will reconcile keyed Components', async () => {
    class Item extends Component {
      value = '';
      render() {
        return <li>{this.value}</li>;
      }
    }

    class App extends Component {
      items = ['a', 'b'];
      render() {
        return <ul>{this.items.map((value) => <Item key={value} value={value} />)}</ul>;
      }
    }

    const [app, root] = mount(App);
    expect(root.textContent).toBe('ab');

    app.items = ['b', 'c'];
    await flushMicrotasks();
    expect(root.textContent).toBe('bc');
  });
});
