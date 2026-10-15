import { describe, expect, it, vi } from 'vitest';

import { Component, State, has } from '@expressive/mvc';
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

describe('renderable State', () => {
  it('will pass children through a State without render', () => {
    class Bare extends State {}
    const root = document.createElement('main');

    render(<div><Bare>text</Bare><Bare /></div>, root);
    expect(root.textContent).toBe('text');
  });

  it('will be owned by enclosing Component', () => {
    let inner!: State;

    class Panel extends State {
      render() {
        return null;
      }
    }

    class Outer extends Component {
      render() {
        return <Panel is={(panel) => (inner = panel)} />;
      }
    }

    const [outer] = mount(Outer);

    expect(outer.get(State, false)).toBeUndefined();
    expect(inner.get(State)).toBe(outer);
  });

  it('will render a State with a render method', async () => {
    const lifecycle: string[] = [];
    let panel!: Panel;

    class Panel extends State {
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
    const release = render(<Panel label="busy" is={(value) => (panel = value)} />, root);

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
    class Panel extends State {
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

  it('will pass children through and provide a State without render', async () => {
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

    const root = document.createElement('main');
    const release = render(
      <>
        <Session name="Grace" is={(value) => (session = value)}>
          <Leaf />
        </Session>
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

  it('will render a client extension of a plain State', async () => {
    class Session extends State {
      user = 'anon';
    }

    class SessionView extends Session {
      render() {
        return <span>{this.user}</span>;
      }
    }

    function Leaf() {
      return <b>{Session.get().user}</b>;
    }

    const [view, root] = mount(SessionView, { user: 'ada', children: <Leaf /> });

    expect(root.textContent).toBe('ada');
    expect(view).toBeInstanceOf(Session);

    view.user = 'grace';
    await flushMicrotasks();
    expect(root.textContent).toBe('grace');
  });

  it('will render a State instance inline', async () => {
    class Panel extends State {
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

  it('will own a boundary only when a State declares fallback or catch', async () => {
    class Bare extends State {
      broken = true;
      render() {
        if (this.broken) throw new Error('broken');
        return <p>bare</p>;
      }
    }

    class Guarded extends State {
      fallback = <i>guarded</i>;
      broken = true;

      catch() {
        this.broken = false;
      }

      render() {
        if (this.broken) throw new Error('broken');
        return <p>guarded</p>;
      }
    }

    class App extends Component {
      fallback = <i>outer</i>;
      caught = 0;

      catch() {
        this.caught++;
      }

      render() {
        return <Bare />;
      }
    }

    const [app, root] = mount(App);
    expect(root.textContent).toBe('outer');
    expect(app.caught).toBe(1);

    const other = place(<Guarded />);
    expect(other.textContent).toBe('guarded');
    await flushMicrotasks();
    expect(other.textContent).toBe('guarded');
  });

  it('will own a boundary from a fallback on the element', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = () => loaded;

    class Plain extends State {
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

  it('will keep a State which suspends itself', async () => {
    const loaded = mockPromise<void>();
    const created = vi.fn();
    let ready = false;

    class Report extends State {
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

    class Guarded extends State {
      fallback: Component.Node = <i>member</i>;

      render() {
        return <Lazy />;
      }
    }

    const root = place(<Guarded fallback={<i>element</i>} />);
    expect(root.textContent).toBe('element');

    const other = place(<><Guarded /><div>{Guarded.new() as never}</div></>);
    expect(other.textContent).toBe('membermember');

    if (false) {
      class Labelled extends State {
        fallback = 'label' as const;
      }

      // @ts-expect-error a member named fallback narrows the element's attribute
      <Labelled fallback={<i />} />;
    }
  });

  it('will call an element catch with the error and instance', async () => {
    const caught = vi.fn();
    let plain!: Plain;

    class Plain extends State {
      broken = true;

      render() {
        if (this.broken) throw new Error('broken');
        return <p>fixed</p>;
      }
    }

    const root = place(
      <Plain
        is={(value) => (plain = value)}
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

    class Outer extends State {
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

    class Panel extends State {
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

  it('will reconcile keyed renderable States', async () => {
    class Item extends State {
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
