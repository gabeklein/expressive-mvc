import { describe, expect, it, vi } from 'vitest';

import { Component, State, has, map } from '@expressive/mvc';
import { Fragment, Portal, render } from './index';
import { flushMicrotasks, mockPromise } from '../test.setup';
import { vnode } from './vnode';

if (false) {
  // @ts-expect-error @expressive/dom uses className, not the class attribute name.
  <div class="legacy" />;
}

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
              className="next"
              data-state={false}
              hidden={false}
              onClick={second}
              ref={(node) => refs.push(node)}
              style={['next-style', { height: 12 }]}
              tabIndex={undefined}
            >
              after
            </div>
          );

        if (this.mode == 2)
          return <div dangerouslySetInnerHTML={{ __html: '<b>trusted</b>' }} />;

        if (this.mode == 3)
          return <div ref={objectRef} style={{ color: 'red', flexGrow: 0, height: null, width: 0 }}>children</div>;

        return <div style={null}>unstyled</div>;
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
    expect(node.className).toBe('next next-style');
    expect(node.getAttribute('data-state')).toBe('false');
    expect(node.hidden).toBe(false);
    expect(node.title).toBe('');
    expect(node.style.height).toBe('12px');
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
    expect(node.style.flexGrow).toBe('0');
    expect(node.style.width).toBe('0px');
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

  it('will bind camel-cased, multi-word and React-spelled events', () => {
    const keyDown = vi.fn();
    const pointerDown = vi.fn();
    const clicked = vi.fn();
    const values: string[] = [];
    const root = document.body.appendChild(document.createElement('main'));

    render(
      <>
        <input
          autoFocus
          onKeyDown={(event) => keyDown(event.key)}
          onPointerDownCapture={pointerDown}
          onInput={(event) => values.push(event.currentTarget.value)}
        />
        <span onDoubleClick={clicked} />
      </>,
      root
    );
    const node = root.querySelector('input')!;

    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    node.dispatchEvent(new Event('pointerdown'));
    node.value = 'typed';
    node.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector('span')!.dispatchEvent(new MouseEvent('dblclick'));

    expect(document.activeElement).toBe(node);
    expect(keyDown).toHaveBeenCalledWith('Enter');
    expect(pointerDown).toHaveBeenCalledTimes(1);
    expect(values).toEqual(['typed']);
    expect(clicked).toHaveBeenCalledOnce();
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
    const span = root.querySelector('span');

    parent.label = 'b';
    await flushMicrotasks();
    expect(root.textContent).toBe('b0');
    expect(root.querySelector('span')).toBe(span);
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

  it('will recursively compose classes and inline styles', async () => {
    class Styled extends Component {
      native: string | undefined = 'external';
      mode = 0;
      initial = [
        ' base\ttwo height: 12px ',
        false,
        null,
        undefined,
        '',
        [
          { color: 'red', height: 12, opacity: 1, width: 10 },
          [{ color: 'blue', height: null, opacity: 0, width: 20 }]
        ]
      ] as const;

      render() {
        return (
          <div
            {...({ class: 'legacy' } as any)}
            className={this.native}
            style={this.mode == 0 ? this.initial : this.mode == 1 ? ['next', { height: 4 }] : null}
          />
        );
      }
    }

    let view!: Styled;
    const root = document.createElement('main');
    render(<Styled is={(value) => (view = value)} />, root);
    const node = root.querySelector('div')!;

    expect(node.className).toBe('external base two height: 12px');
    expect(node.style.color).toBe('blue');
    expect(node.style.height).toBe('');
    expect(node.style.opacity).toBe('0');
    expect(node.style.width).toBe('20px');

    view.native = 'changed';
    await flushMicrotasks();
    expect(node.className).toBe('changed base two height: 12px');
    expect(node.style.width).toBe('20px');

    view.mode = 1;
    await flushMicrotasks();
    expect(node.className).toBe('changed next');
    expect(node.style.color).toBe('');
    expect(node.style.height).toBe('4px');
    expect(node.style.width).toBe('');

    view.native = undefined;
    await flushMicrotasks();
    expect(node.className).toBe('next');

    view.mode = 2;
    await flushMicrotasks();
    expect(node.hasAttribute('class')).toBe(false);
    expect(node.style.height).toBe('');
  });

  it('will forward style through component roots', async () => {
    const Leaf = (_props: any) => <div className="leaf" style={['local', { color: 'blue' }]} />;
    const Middle = (_props: any) => <Leaf style={['inner', { color: 'green', height: 4 }]} />;

    class View extends Component {
      active = true;

      render() {
        return (
          <Middle style={[false, this.active ? 'call' : 'updated', { color: 'red', width: this.active ? 3 : 6 }]} />
        );
      }
    }

    let view!: View;
    const root = document.createElement('main');
    render(<View is={(value) => (view = value)} />, root);
    const node = root.querySelector('div')!;

    expect(node.className).toBe('leaf local inner call');
    expect(node.style.color).toBe('red');
    expect(node.style.height).toBe('4px');
    expect(node.style.width).toBe('3px');

    view.active = false;
    await flushMicrotasks();
    expect(node.className).toBe('leaf local inner updated');
    expect(node.style.width).toBe('6px');
  });

  it('will not forward class through components', () => {
    const Leaf = (_props: any) => <div className="leaf" />;
    const root = document.createElement('main');

    render(<Leaf {...({ class: 'outer' } as any)} />, root);

    expect(root.querySelector('div')?.className).toBe('leaf');
  });

  it('will not forward style a component derives from', () => {
    const Field = ({ style }: { style?: any }) => (
      <label>
        <input style={{ ...style, outlineStyle: 'none' }} />
      </label>
    );
    const root = document.createElement('main');

    render(<Field style={['invalid', { color: 'red' }]} />, root);

    const input = root.querySelector('input')!;
    expect(root.querySelector('label')?.hasAttribute('class')).toBe(false);
    expect(input.className).toBe('invalid');
    expect(input.style.color).toBe('red');
    expect(input.style.outlineStyle).toBe('none');
  });

  it('will pass readable, frozen declarations through a component', () => {
    const received: any[] = [];
    const Read = ({ style }: { style?: any }) => {
      received.push(style);
      return <i />;
    };
    const root = document.createElement('main');

    render(<><Read style={[{ color: 'red' }, false, ['tag', { color: 'blue', width: 2 }]]} /><Read style={[false, null]} /></>, root);

    const [style, empty] = received;
    expect({ ...style }).toMatchObject({ color: 'blue', width: 2 });
    expect(Object.keys(style)).toEqual(['color', 'width']);
    expect(Object.isFrozen(style)).toBe(true);
    expect(empty).toBeUndefined();
  });

  it('will keep forwarded classes through spread, pluck and merge', () => {
    const handles: any[] = [];
    const Capture = ({ style }: { style?: any }) => {
      handles.push(style);
      return null;
    };
    const root = document.createElement('main');

    render(<><Capture style={['a', { color: 'red', width: 1 }]} /><Capture style={['b', { height: 2 }]} /></>, root);

    const [a, b] = handles;
    const { color, ...rest } = a;
    const target = document.createElement('main');

    render(
      <>
        <i style={{ ...a, color: 'blue' }} />
        <b style={rest} />
        <u style={{ ...a, ...b }} />
        <s style={{ [Symbol('foreign')]: {}, color: 'red' } as any} />
      </>,
      target
    );

    const [override, plucked, merged, foreign] = [...target.children] as HTMLElement[];
    expect(color).toBe('red');
    expect(override.className).toBe('a');
    expect(override.style.color).toBe('blue');
    expect(plucked.className).toBe('a');
    expect(plucked.style.color).toBe('');
    expect(plucked.style.width).toBe('1px');
    expect(merged.className).toBe('a b');
    expect(merged.style.height).toBe('2px');
    expect(foreign.hasAttribute('class')).toBe(false);
    expect(foreign.style.color).toBe('red');
  });

  it('will keep styled props stable for a reused element', async () => {
    const received: object[] = [];
    const Leaf = (props: { style?: string }) => {
      received.push(props);
      return <i />;
    };
    const leaf = <Leaf style="kept" />;

    class View extends Component {
      count = 0;

      render() {
        return <>{this.count}{leaf}</>;
      }
    }

    let view!: View;
    const root = document.createElement('main');
    render(<View is={(value) => (view = value)} />, root);

    view.count = 1;
    await flushMicrotasks();

    expect(received).toHaveLength(2);
    expect(received[0]).toBe(received[1]);
    expect(root.querySelector('i')?.className).toBe('kept');
  });

  it('will not forward style a Component reads', () => {
    class Field extends Component {
      render() {
        return <label><input style={(this.props as any).style} /></label>;
      }
    }

    class Declared extends Component {
      style?: string = undefined;

      render() {
        return <p><b style={this.style} /></p>;
      }
    }

    const root = document.createElement('main');

    render(<><Field style="read" /><Declared style="owned" /></>, root);

    expect(root.querySelector('label')?.hasAttribute('class')).toBe(false);
    expect(root.querySelector('input')?.className).toBe('read');
    expect(root.querySelector('p')?.hasAttribute('class')).toBe(false);
    expect(root.querySelector('b')?.className).toBe('owned');
  });

  it('will honor explicit appearance placement, also through component instances', () => {
    class Inner extends Component {
      render() {
        return <span />;
      }
    }

    const Placed = ({ style }: any) => (
      <section>
        <span style={style} />
      </section>
    );
    const Instance = ({ style }: any) => new Inner({ style });
    const root = document.createElement('main');

    render(<><Placed style={['selected', { color: 'red' }]} /><Instance {...({ style: 'placed' } as any)} /></>, root);
    const [selected, placed] = root.querySelectorAll('span');

    expect(root.querySelector('section')?.hasAttribute('class')).toBe(false);
    expect(root.querySelector('section')?.getAttribute('style')).toBeNull();
    expect(selected.className).toBe('selected');
    expect(selected.style.color).toBe('red');
    expect(placed.className).toBe('placed');
  });

  it('will update forwarded appearance on collection roots', async () => {
    const items = new has.List([<span />]);

    const Items = (_props: any) => items as any;
    class View extends Component {
      active = true;

      render() {
        return <Items {...({ style: this.active ? 'active' : 'inactive' } as any)} />;
      }
    }

    let view!: View;
    const root = document.createElement('main');
    render(<View is={(value) => (view = value)} />, root);
    expect(root.querySelector('span')?.className).toBe('active');

    view.active = false;
    await flushMicrotasks();
    expect(root.querySelector('span')?.className).toBe('inactive');
  });

  it('will forward appearance to fragment roots', () => {
    const Pair = () => <><i /><b /></>;
    const root = document.createElement('main');

    render(<Pair style="shared" />, root);

    expect([...root.children].map((node) => node.className)).toEqual(['shared', 'shared']);
  });

  it('will render SVG, fragments and primitive updates', async () => {
    class Shapes extends Component {
      count: number | bigint = 1;

      render() {
        return (
          <>
            text:{this.count}
            <label htmlFor="shape">shape</label>
            <svg viewBox="0 0 10 10" {...({ focusable: true } as any)}>
              <circle
                {...({ class: 'legacy' } as any)}
                className="shape"
                cx={5}
                cy={5}
                r={4}
                style={['active', { opacity: 0.5 }]}
              />
            </svg>
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
    expect(root.querySelector('circle')?.getAttribute('class')).toBe('shape active');
    expect((root.querySelector('circle') as SVGCircleElement).style.opacity).toBe('0.5');
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

  it('will assign and remove settable properties on SVG elements', async () => {
    class Dial extends Component {
      on = true;

      render() {
        return <svg tabIndex={this.on ? 0 : undefined} viewBox="0 0 10 10" />;
      }
    }

    let dial!: Dial;
    const root = document.createElement('main');
    render(<Dial is={(value) => (dial = value)} />, root);
    const svg = root.querySelector('svg')!;

    expect(svg.getAttribute('tabindex')).toBe('0');
    expect(svg.hasAttribute('tabIndex')).toBe(false);
    expect(svg.getAttribute('viewBox')).toBe('0 0 10 10');

    dial.on = false;
    await flushMicrotasks();
    expect(svg.hasAttribute('tabindex')).toBe(false);
  });

  it('will write contentEditable as an enumerated attribute', () => {
    const root = document.createElement('main');
    render(<><div contentEditable={false} /><div contentEditable={true} /></>, root);
    const [off, on] = root.querySelectorAll('div');

    expect(off.getAttribute('contenteditable')).toBe('false');
    expect(on.getAttribute('contenteditable')).toBe('true');
  });

  it('will stringify booleans on data and enumerated attributes', async () => {
    class Flags extends Component {
      on = true;

      render() {
        const { on } = this;
        return <a data-on={on} draggable={on} spellcheck={!on} aria-hidden={on} />;
      }
    }

    let flags!: Flags;
    const root = document.createElement('main');
    render(<Flags is={(value) => (flags = value)} />, root);
    const link = root.querySelector('a')!;

    expect(link.getAttribute('data-on')).toBe('true');
    expect(link.getAttribute('draggable')).toBe('true');
    expect(link.getAttribute('spellcheck')).toBe('false');
    expect(link.getAttribute('aria-hidden')).toBe('true');

    flags.on = false;
    await flushMicrotasks();
    expect(link.getAttribute('data-on')).toBe('false');
    expect(link.getAttribute('draggable')).toBe('false');
    expect(link.getAttribute('spellcheck')).toBe('true');
    expect(link.getAttribute('aria-hidden')).toBe('false');
  });

  it('will focus an autofocus element only once it is inserted', async () => {
    class Editor extends Component {
      editing = false;
      tick = 0;

      render() {
        const { editing, tick } = this;
        return editing ? <input autofocus data-tick={tick} /> : <button>edit</button>;
      }
    }

    let editor!: Editor;
    const detached = document.createElement('main');
    render(<input autofocus />, detached);
    const root = document.body.appendChild(document.createElement('main'));
    render(<Editor is={(value) => (editor = value)} />, root);

    expect(document.activeElement).not.toBe(detached.querySelector('input'));

    editor.editing = true;
    await flushMicrotasks();
    const input = root.querySelector('input')!;
    expect(document.activeElement).toBe(input);

    input.blur();
    editor.tick++;
    await flushMicrotasks();
    expect(document.activeElement).not.toBe(input);
  });

  it('will restore a controlled value when a write is rejected', async () => {
    class Name extends Component {
      name = 'abc';

      render() {
        return (
          <input
            value={this.name}
            onInput={(event) => {
              const next = event.currentTarget.value;
              if (next.length <= 3) this.name = next;
            }}
          />
        );
      }
    }

    const root = document.body.appendChild(document.createElement('main'));
    render(<Name />, root);
    const input = root.querySelector('input')!;

    input.value = 'abcd';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushMicrotasks();
    expect(input.value).toBe('abc');

    input.value = 'ab';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushMicrotasks();
    expect(input.value).toBe('ab');
  });

  it('will not touch a controlled value the handler accepted', async () => {
    let writes = 0;

    class Name extends Component {
      name = 'hello';

      render() {
        return <input value={this.name} onInput={(event) => (this.name = event.currentTarget.value)} />;
      }
    }

    const root = document.body.appendChild(document.createElement('main'));
    render(<Name />, root);
    const input = root.querySelector('input')!;
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!;

    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => descriptor.get!.call(input),
      set: (value) => {
        writes++;
        descriptor.set!.call(input, value);
      }
    });

    input.value = 'hel!lo';
    writes = 0;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushMicrotasks();

    expect(input.value).toBe('hel!lo');
    expect(writes).toBe(0);
  });

  it('will restore after the event a controlled handler listens to', async () => {
    class Form extends Component {
      agreed = false;
      text = 'a';

      render() {
        const { agreed, text } = this;

        return (
          <>
            <input type="checkbox" checked={agreed} onChange={(event) => (this.agreed = event.currentTarget.checked)} />
            <input value={text} onChange={(event) => (this.text = event.currentTarget.value)} />
          </>
        );
      }
    }

    const root = document.body.appendChild(document.createElement('main'));
    render(<Form />, root);
    const [box, field] = root.querySelectorAll('input');

    box.checked = true;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await flushMicrotasks();
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await flushMicrotasks();
    expect(box.checked).toBe(true);

    field.value = 'ab';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await flushMicrotasks();
    expect(field.value).toBe('ab');

    field.dispatchEvent(new Event('change', { bubbles: true }));
    await flushMicrotasks();
    expect(field.value).toBe('ab');
  });

  it('will keep a controlled field without a handler on its value', async () => {
    const root = document.body.appendChild(document.createElement('main'));
    render(<><input value="fixed" /><input type="checkbox" checked={false} /><input /><input type="range" value={150} max={200} /><select value="b"><option value="a" /><option value="b" /></select></>, root);
    const [text, box, free, range] = root.querySelectorAll('input');
    const select = root.querySelector('select')!;

    expect(range.value).toBe('150');
    expect(select.value).toBe('b');

    select.value = 'a';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    free.value = 'free';
    free.dispatchEvent(new Event('input', { bubbles: true }));

    text.value = 'typed';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await flushMicrotasks();

    expect(text.value).toBe('fixed');
    expect(box.checked).toBe(false);
    expect(free.value).toBe('free');
    expect(select.value).toBe('b');
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

  it('will render owned collections read through a tracked scope', async () => {
    class Item extends Component {
      name = '';

      render() {
        return <li>{this.name}</li>;
      }
    }

    class Lists extends Component {
      list = has(['one']);
      pool = has(Item);
      values = map<string, string>();

      new() {
        this.pool.add({ name: 'P' });
        this.values.set('a', 'A');
      }

      render() {
        return <>{this.list}<ul>{this.pool}</ul>{this.values}</>;
      }
    }

    let lists!: Lists;
    const root = document.createElement('main');
    render(<Lists is={(value) => (lists = value)} />, root);
    expect(root.textContent).toBe('onePA');

    lists.list.push('two');
    lists.pool.add({ name: 'Q' });
    lists.values.set('b', 'B');
    await flushMicrotasks();
    expect(root.textContent).toBe('onetwoPQAB');
  });

  it('will keep and move instances read through a tracked scope', async () => {
    class Item extends Component {
      name = '';
      order = 0;

      render() {
        return <li>{this.name}</li>;
      }
    }

    class Items extends Component {
      items = has(Item);
      tick = 0;

      new() {
        this.items.add({ name: 'a', order: 1 });
        this.items.add({ name: 'b', order: 2 });
      }

      render() {
        const { tick, items } = this;
        const sorted = [...items].sort((x, y) => x.order - y.order);

        return <ul data-tick={tick}>{sorted}</ul>;
      }
    }

    let list!: Items;
    const root = document.createElement('main');
    render(<Items is={(value) => (list = value)} />, root);
    const [a, b] = root.querySelectorAll('li');

    list.tick++;
    await flushMicrotasks();
    expect([...root.querySelectorAll('li')]).toEqual([a, b]);

    [...list.items][1].order = 0;
    await flushMicrotasks();
    expect(root.textContent).toBe('ba');
    expect([...root.querySelectorAll('li')]).toEqual([b, a]);
  });

  it('will resolve a selector target once and move when it changes', async () => {
    const first = document.createElement('aside');
    const second = document.createElement('aside');
    const query = vi.spyOn(document, 'querySelectorAll');

    first.id = 'first';
    second.className = 'second';
    document.body.append(first, second);

    class Modal extends State {
      message = 'open';
      target = '#first';

      render() {
        return <Portal into={this.target}><b>{this.message}</b></Portal>;
      }
    }

    let modal!: Modal;
    const release = render(<Modal is={(value) => (modal = value)} />, document.createElement('main'));

    expect(first.textContent).toBe('open');

    modal.message = 'still';
    await flushMicrotasks();
    expect(first.textContent).toBe('still');
    expect(query).toBeCalledTimes(1);

    modal.target = '.second';
    await flushMicrotasks();
    expect(first.textContent).toBe('');
    expect(second.textContent).toBe('still');
    expect(query).toBeCalledTimes(2);

    release();
    query.mockRestore();
    first.remove();
    second.remove();
  });

  it('will resolve a selector target rendered beside it off-document', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = () => loaded;

    class Page extends State {
      fallback = <i>wait</i>;

      render() {
        return <Lazy />;
      }
    }

    const root = document.createElement('main');
    document.body.append(root);
    render(<Page />, root);

    loaded.resolve(() => <><div id="slot" /><Portal into="#slot"><b>moved</b></Portal></>);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(root.querySelector('#slot')!.textContent).toBe('moved');
    root.remove();
  });

  it('will throw if a selector target is missing or ambiguous', () => {
    const one = document.createElement('i');
    const two = document.createElement('i');

    one.className = two.className = 'many';
    document.body.append(one, two);

    expect(() => render(<Portal into="#none">x</Portal>, document.createElement('main')))
      .toThrow('Portal target "#none" was not found.');
    expect(() => render(<Portal into=".many">x</Portal>, document.createElement('main')))
      .toThrow('Portal target ".many" is ambiguous.');

    one.remove();
    two.remove();
  });

  it('will keep keyed fragments across a reorder', async () => {
    class List extends State {
      order = ['a', 'b'];

      render() {
        return <>{this.order.map((id) => <Fragment key={id}><dt>{id}</dt><dd>{id}</dd></Fragment>)}</>;
      }
    }

    let list!: List;
    const root = document.createElement('dl');
    render(<List is={(value) => (list = value)} />, root);

    const first = root.querySelector('dt');

    list.order = ['b', 'a'];
    await flushMicrotasks();

    expect(root.textContent).toBe('bbaa');
    expect(root.querySelectorAll('dt')[1]).toBe(first);
  });

  it('will render and move portal children with logical context', async () => {
    const aside = document.createElement('aside');
    const nextPortal = document.createElement('aside');

    class Modal extends Component {
      message = 'open';
      target = aside;

      render() {
        return <Portal into={this.target}><button>{this.message}</button></Portal>;
      }
    }

    let modal!: Modal;
    const root = document.createElement('main');
    const release = render(<Modal is={(value) => (modal = value)} />, root);

    expect(root.querySelector('button')).toBeNull();
    expect(aside.textContent).toBe('open');

    modal.message = 'closed';
    await flushMicrotasks();
    expect(aside.textContent).toBe('closed');

    modal.target = nextPortal;
    await flushMicrotasks();
    expect(aside.textContent).toBe('');
    expect(nextPortal.textContent).toBe('closed');

    release();
    expect(nextPortal.textContent).toBe('');
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
    expect(cleanup).not.toHaveBeenCalled();
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
    class Bare extends State {}
    const root = document.createElement('main');

    expect(() => render({} as never, root)).toThrow('Cannot render');
    expect(() => render(vnode(Symbol('unknown'), {}), root)).toThrow('Cannot render');
    expect(() => render(<div>{Bare.new() as never}</div>, root)).toThrow('Cannot render');
    expect(root.textContent).toBe('');
  });
});

describe('renderable State', () => {
  it('will be owned by enclosing Component', () => {
    let outer!: Outer;
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

    const release = render(<Outer is={(value) => (outer = value)} />, document.createElement('main'));

    expect(outer.get(State, false)).toBeUndefined();
    expect(inner.get(State)).toBe(outer);

    release();
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

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);
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

    let view!: SessionView;
    const root = document.createElement('main');
    render(
      <SessionView user="ada" is={(value) => (view = value)}>
        <Leaf />
      </SessionView>,
      root
    );

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
    const root = document.createElement('main');
    render(<div>{panel}</div>, root);
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

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);
    expect(root.textContent).toBe('outer');
    expect(app.caught).toBe(1);

    const other = document.createElement('main');
    render(<Guarded />, other);
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

    const root = document.createElement('main');
    render(<Plain fallback={<i>loading</i>} />, root);
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

    let report!: Report;
    const root = document.createElement('main');
    render(<Report is={(value) => (report = value)} fallback={<i>loading</i>} />, root);
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

    const root = document.createElement('main');
    render(<Guarded fallback={<i>element</i>} />, root);
    expect(root.textContent).toBe('element');

    const other = document.createElement('main');
    render(<><Guarded /><div>{Guarded.new() as never}</div></>, other);
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

    const root = document.createElement('main');
    render(
      <Plain
        is={(value) => (plain = value)}
        fallback={<i>recovering</i>}
        catch={(error: Error, instance: Plain) => {
          caught(error.message, instance);
          instance.broken = false;
        }}
      />,
      root
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

    const root = document.createElement('main');
    render(<Outer />, root);
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

    let panel!: Panel;
    const root = document.createElement('main');
    render(<Panel is={(value) => (panel = value)} />, root);
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

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);
    expect(root.textContent).toBe('ab');

    app.items = ['b', 'c'];
    await flushMicrotasks();
    expect(root.textContent).toBe('bc');
  });
});
