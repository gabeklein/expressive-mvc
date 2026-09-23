import { describe, expect, it, vi } from 'vitest';

import { Component, State, createPortal, has, map, render } from './index';
import { flushMicrotasks } from '../test.setup';
import { vnode } from './vnode';

describe('render', () => {
  it('will patch native properties, events, styles, refs and raw HTML', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const capture = vi.fn();
    const refs: Array<Element | null> = [];
    const objectRef: { current: HTMLDivElement | null } = { current: null };

    class Native extends Component {
      mode = 0;

      render() {
        if (this.mode == 0)
          return (
            <div
              aria-label="greeting"
              className="ready"
              data-state="open"
              hidden
              onClick={first}
              onClickCapture={capture}
              ref={(node) => refs.push(node)}
              style={{
                flexGrow: 1,
                lineHeight: 1.2,
                opacity: 0.5,
                width: 10,
                zIndex: 2
              }}
              tabIndex={2}
              title="before"
            >
              <span>safe</span>
            </div>
          );

        if (this.mode == 1)
          return (
            <div
              class="next"
              data-state={false}
              hidden={false}
              onClick={second}
              ref={(node) => refs.push(node)}
              style="height: 12px"
              tabIndex={undefined}
            >
              after
            </div>
          );

        if (this.mode == 2)
          return <div dangerouslySetInnerHTML={{ __html: '<b>trusted</b>' }} />;

        if (this.mode == 3)
          return <div ref={objectRef} style={{ color: 'red', height: null, width: 0 }}>children</div>;

        return <div style={null as any}>unstyled</div>;
      }
    }

    let view!: Native;
    const root = document.createElement('main');
    const release = render(<Native is={(value) => (view = value)} />, root);
    const node = root.querySelector('div')!;

    expect(node.className).toBe('ready');
    expect(node.getAttribute('aria-label')).toBe('greeting');
    expect(node.getAttribute('data-state')).toBe('open');
    expect(node.hidden).toBe(true);
    expect(node.style.flexGrow).toBe('1');
    expect(node.style.lineHeight).toBe('1.2');
    expect(node.style.opacity).toBe('0.5');
    expect(node.style.width).toBe('10px');
    expect(node.style.zIndex).toBe('2');
    node.click();
    expect(first).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledOnce();

    view.mode = 1;
    await flushMicrotasks();
    expect(root.querySelector('div')).toBe(node);
    expect(node.className).toBe('next');
    expect(node.hasAttribute('data-state')).toBe(false);
    expect(node.hidden).toBe(false);
    expect(node.title).toBe('');
    expect(node.style.cssText).toContain('height: 12px');
    node.click();
    expect(first).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();

    view.mode = 2;
    await flushMicrotasks();
    expect(node.innerHTML).toBe('<b>trusted</b>');

    view.mode = 3;
    await flushMicrotasks();
    expect(node.textContent).toBe('children');
    expect(node.style.color).toBe('red');
    expect(node.style.height).toBe('');
    expect(node.tabIndex).toBe(-1);
    expect(node.hasAttribute('tabindex')).toBe(false);
    expect(objectRef.current).toBe(node);

    view.mode = 4;
    await flushMicrotasks();
    expect(node.textContent).toBe('unstyled');
    expect(node.style.color).toBe('');

    release();
    expect(refs[0]).toBe(node);
    expect(refs.at(-1)).toBe(null);
    expect(objectRef.current).toBeNull();
  });

  it('will write boolean aria attributes as strings', async () => {
    class View extends Component {
      open = false;

      render() {
        return <button aria-expanded={this.open} aria-hidden={!this.open ? undefined : false} />;
      }
    }

    let view!: View;
    const root = document.createElement('main');
    render(<View is={(value) => (view = value)} />, root);
    const node = root.querySelector('button')!;

    expect(node.getAttribute('aria-expanded')).toBe('false');
    expect(node.hasAttribute('aria-hidden')).toBe(false);

    view.open = true;
    await flushMicrotasks();
    expect(node.getAttribute('aria-expanded')).toBe('true');
    expect(node.getAttribute('aria-hidden')).toBe('false');
  });

  it('will set and remove inline custom properties', async () => {
    class View extends Component {
      gap: string | undefined = '4px';

      render() {
        return <div style={{ ['--gap' as 'color']: this.gap }} />;
      }
    }

    let view!: View;
    const root = document.createElement('main');
    render(<View is={(value) => (view = value)} />, root);
    const node = root.querySelector('div')!;

    expect(node.style.getPropertyValue('--gap')).toBe('4px');

    view.gap = undefined;
    await flushMicrotasks();
    expect(node.style.getPropertyValue('--gap')).toBe('');
  });

  it('will bind camel-cased multi-word events', () => {
    const keyDown = vi.fn();
    const pointerDown = vi.fn();
    const root = document.createElement('main');

    render(<input onKeyDown={(event) => keyDown(event.key)} onPointerDownCapture={pointerDown} />, root);
    const node = root.querySelector('input')!;

    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    node.dispatchEvent(new Event('pointerdown'));

    expect(keyDown).toHaveBeenCalledWith('Enter');
    expect(pointerDown).toHaveBeenCalledTimes(1);
  });

  it('will render a child once when its parent re-renders it', async () => {
    class Count extends State {
      value = 0;
    }

    const renders = vi.fn();

    function Child() {
      const { value } = Count.get();
      renders(value);
      return <b>{value}</b>;
    }

    function Parent() {
      const { value } = Count.get();
      return <p>{value}<Child /></p>;
    }

    class App extends Component {
      count = new Count();

      render() {
        return <Parent />;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);
    renders.mockClear();

    app.count.value = 1;
    await flushMicrotasks();

    expect(renders.mock.calls).toEqual([[1]]);
    expect(root.textContent).toBe('11');
  });

  it('will remove attributes without leaving reflected values', async () => {
    class Link extends Component {
      on = true;

      render() {
        return <a href={this.on ? '/next' : undefined} id={this.on ? 'link' : undefined}>go</a>;
      }
    }

    let view!: Link;
    const root = document.createElement('main');
    render(<Link is={(value) => (view = value)} />, root);
    const node = root.querySelector('a')!;

    view.on = false;
    await flushMicrotasks();
    expect(node.hasAttribute('href')).toBe(false);
    expect(node.hasAttribute('id')).toBe(false);
  });

  it('will apply select and range values after options and bounds', () => {
    const root = document.createElement('main');

    render(
      <>
        <select value="b">
          <option value="a">a</option>
          <option value="b">b</option>
        </select>
        <input type="range" value={150} max={200} />
      </>,
      root
    );

    expect(root.querySelector('select')!.value).toBe('b');
    expect(root.querySelector('input')!.value).toBe('150');
  });

  it('will restore controlled values when an element re-renders', async () => {
    class Form extends Component {
      text = 'fixed';
      on = false;
      tick = 0;

      render() {
        return <>{this.tick}<input value={this.text} /><input type="checkbox" checked={this.on} /></>;
      }
    }

    let view!: Form;
    const root = document.createElement('main');
    render(<Form is={(value) => (view = value)} />, root);
    const [text, box] = root.querySelectorAll('input');

    text.value = 'typed';
    box.checked = true;
    view.tick++;
    await flushMicrotasks();

    expect(text.value).toBe('fixed');
    expect(box.checked).toBe(false);
  });

  it('will attach refs after children mount', () => {
    let count = -1;
    const root = document.createElement('main');

    render(<ul ref={(node) => { if (node) count = node.children.length; }}><li /><li /></ul>, root);

    expect(count).toBe(2);
  });

  it('will switch from children to raw HTML', async () => {
    const Child = () => <b>child</b>;

    class View extends Component {
      raw = false;

      render() {
        return this.raw
          ? <div dangerouslySetInnerHTML={{ __html: '<i>raw</i>' }} />
          : <div><Child /></div>;
      }
    }

    let view!: View;
    const root = document.createElement('main');
    render(<View is={(value) => (view = value)} />, root);

    view.raw = true;
    await flushMicrotasks();
    expect(root.querySelector('div')!.innerHTML).toBe('<i>raw</i>');
  });

  it('will keep own updates of a child after its parent re-renders', async () => {
    const renders = vi.fn();

    class Child extends Component {
      count = 0;
      label = '';

      render() {
        renders(this.label);
        return <span>{this.label}{this.count}</span>;
      }
    }

    let child!: Child;

    class Parent extends Component {
      label = 'a';
      bump = false;

      render() {
        if (this.bump) child.count = 5;
        return <Child label={this.label} is={(value) => (child = value)} />;
      }
    }

    let parent!: Parent;
    const root = document.createElement('main');
    render(<Parent is={(value) => (parent = value)} />, root);

    parent.label = 'b';
    await flushMicrotasks();
    expect(root.textContent).toBe('b0');
    expect(renders).toHaveBeenLastCalledWith('b');

    child.count = 1;
    await flushMicrotasks();
    expect(root.textContent).toBe('b1');

    parent.label = 'c';
    parent.bump = true;
    await flushMicrotasks();
    expect(root.textContent).toBe('c5');
  });

  it('will type SVG attributes and custom properties', () => {
    const root = document.createElement('main');

    render(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" style={{ '--tone': 'red' }}>
        <path d="M0 0L10 10" fill="none" stroke="red" transform="scale(1)" />
      </svg>,
      root
    );

    const path = root.querySelector('path')!;
    expect(path.getAttribute('d')).toBe('M0 0L10 10');
    expect(path.getAttribute('stroke')).toBe('red');
    expect(root.querySelector('svg')!.style.getPropertyValue('--tone')).toBe('red');
  });

  it('will update numeric styles', async () => {
    class Styled extends Component {
      size = 10;

      render() {
        return <div style={{ flexGrow: this.size / 10, width: this.size }} />;
      }
    }

    let view!: Styled;
    const root = document.createElement('main');
    const release = render(<Styled is={(value) => (view = value)} />, root);
    const node = root.querySelector('div')!;

    expect(node.style.flexGrow).toBe('1');
    expect(node.style.width).toBe('10px');

    view.size = 20;
    await flushMicrotasks();
    expect(node.style.flexGrow).toBe('2');
    expect(node.style.width).toBe('20px');

    view.size = 0;
    await flushMicrotasks();
    expect(node.style.flexGrow).toBe('0');
    expect(node.style.width).toBe('0px');

    release();
  });

  it('will render SVG, fragments and primitive updates', async () => {
    class Shapes extends Component {
      count: number | bigint = 1;

      render() {
        return (
          <>
            text:{this.count}
            <label htmlFor="shape">shape</label>
            <svg viewBox="0 0 10 10" {...({ focusable: true } as any)}><circle cx={5} cy={5} r={4} /></svg>
            {false}
          </>
        );
      }
    }

    let shapes!: Shapes;
    const root = document.createElement('main');
    render(<Shapes is={(value) => (shapes = value)} />, root);

    expect(root.textContent).toBe('text:1shape');
    expect(root.querySelector('circle')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(root.querySelector('label')?.getAttribute('for')).toBe('shape');
    expect(root.querySelector('svg')?.getAttribute('focusable')).toBe('');

    shapes.count = 2n;
    await flushMicrotasks();
    expect(root.textContent).toBe('text:2shape');
  });

  it('will retain keyed DOM ranges while reordering', async () => {
    class List extends Component {
      items = ['a', 'b', 'c'];

      render() {
        return <ul>{this.items.map((item) => <li key={item}>{item}</li>)}</ul>;
      }
    }

    let list!: List;
    const root = document.createElement('main');
    render(<List is={(value) => (list = value)} />, root);
    const before = [...root.querySelectorAll('li')];

    list.items = ['c', 'a', 'b'];
    await flushMicrotasks();
    const after = [...root.querySelectorAll('li')];

    expect(after.map((node) => node.textContent)).toEqual(['c', 'a', 'b']);
    expect(after).toEqual([before[2], before[0], before[1]]);
  });

  it('will render MVC collections directly', async () => {
    const list = new has.List(['one']);
    const pool = new has.Pool((value: string) => value);
    const values = new map.Managed<string, string>([['a', 'A']]);
    pool.add('P');

    function Collections() {
      return <>{list}{pool}{values}</>;
    }

    const root = document.createElement('main');
    render(<Collections />, root);
    expect(root.textContent).toBe('onePA');

    list.push('two');
    values.set('b', 'B');
    await flushMicrotasks();
    expect(root.textContent).toBe('onetwoPAB');
  });

  it('will render and move portal children with logical context', async () => {
    const portal = document.createElement('aside');
    const nextPortal = document.createElement('aside');

    class Modal extends Component {
      message = 'open';
      target = portal;

      render() {
        return createPortal(<button>{this.message}</button>, this.target);
      }
    }

    let modal!: Modal;
    const root = document.createElement('main');
    const release = render(<Modal is={(value) => (modal = value)} />, root);

    expect(root.querySelector('button')).toBeNull();
    expect(portal.textContent).toBe('open');

    modal.message = 'closed';
    await flushMicrotasks();
    expect(portal.textContent).toBe('closed');

    modal.target = nextPortal;
    await flushMicrotasks();
    expect(portal.textContent).toBe('');
    expect(nextPortal.textContent).toBe('closed');

    release();
    expect(nextPortal.textContent).toBe('');
  });

  it('will place an external Component without owning it', () => {
    const cleanup = vi.fn();

    class Message extends Component {
      mount() {
        return cleanup;
      }

      render() {
        return <p>placed</p>;
      }
    }

    const message = Message.new();
    const root = document.createElement('main');
    const release = render(message, root);

    expect(root.textContent).toBe('placed');
    release();
    expect(message.get(null)).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();
    message.set(null);
  });

  it('will replace an existing root and make unmount idempotent', () => {
    const root = document.createElement('main');
    const first = render(<p>one</p>, root);
    const second = render(<p>two</p>, root);

    expect(root.textContent).toBe('two');
    first();
    expect(root.textContent).toBe('two');
    second();
    second();
    expect(root.textContent).toBe('');
  });

  it('will patch class-component props in place', async () => {
    class Child extends Component {
      label = '';

      render() {
        return <span>{this.label}</span>;
      }
    }

    class Parent extends Component {
      label = 'one';
      render() {
        return <Child label={this.label} />;
      }
    }

    let parent!: Parent;
    const root = document.createElement('main');
    render(<Parent is={(value) => (parent = value)} />, root);
    const child = root.querySelector('span');

    parent.label = 'two';
    await flushMicrotasks();
    expect(root.textContent).toBe('two');
    expect(root.querySelector('span')).toBe(child);
  });

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

    let parent!: Parent;
    const root = document.createElement('main');
    render(<Parent is={(value) => (parent = value)} />, root);
    const span = root.querySelector('span');
    parent.tick++;
    await flushMicrotasks();

    expect(root.querySelector('span')).toBe(span);
  });

  it('will patch a directly placed Component and collection', async () => {
    class Message extends Component {
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

    let parent!: Parent;
    const root = document.createElement('main');
    const release = render(<Parent is={(value) => (parent = value)} />, root);
    parent.tick++;
    await flushMicrotasks();
    expect(root.textContent).toBe('1messagefirst');

    parent.useSecond = true;
    await flushMicrotasks();
    expect(root.textContent).toBe('1messagesecond');

    release();
    expect(message.get(null)).toBe(false);
    message.set(null);
  });

  it('will handle colliding and removed keys', async () => {
    class Keys extends Component {
      mode = 0;

      render() {
        if (this.mode == 0) return <section><b key="same">one</b><i key="drop">drop</i></section>;
        if (this.mode == 1) return <section><b key="same">two</b><u key="same">three</u></section>;
        return <section><em>plain</em></section>;
      }
    }

    let keys!: Keys;
    const root = document.createElement('main');
    render(<Keys is={(value) => (keys = value)} />, root);
    keys.mode = 1;
    await flushMicrotasks();
    expect(root.textContent).toBe('twothree');

    keys.mode = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('plain');
  });

  it('will move a keyed multi-node fragment as one range', async () => {
    function Pair({ value }: { value: string }) {
      return <><b>{value}</b><i>{value}</i></>;
    }

    class Pairs extends Component {
      order = ['a', 'b'];
      render() {
        return <section>{this.order.map((value) => <Pair key={value} value={value} />)}</section>;
      }
    }

    let pairs!: Pairs;
    const root = document.createElement('main');
    render(<Pairs is={(value) => (pairs = value)} />, root);
    pairs.order = ['b', 'a'];
    await flushMicrotasks();
    expect([...root.querySelectorAll('b, i')].map((node) => node.textContent)).toEqual(['b', 'b', 'a', 'a']);
  });

  it('will reject unsupported render values and element types', () => {
    const root = document.createElement('main');

    expect(() => render({} as never, root)).toThrow('Cannot render');
    expect(() => render(vnode(Symbol('unknown'), {}), root)).toThrow('Cannot render');
    expect(root.textContent).toBe('');
  });
});
