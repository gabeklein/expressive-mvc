import { describe, expect, it, vi } from 'vitest';

import { Component } from '@expressive/mvc';
import { render } from '../index';
import { flushMicrotasks, mount, place } from '../../test.setup';

if (false) {
  // @ts-expect-error @expressive/dom uses className, not the class attribute name.
  <div class="legacy" />;
}

describe('element', () => {
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

    const [view, root, release] = mount(Native);
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

    const [view, root] = mount(View);
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

  it('will remove attributes without leaving reflected values', async () => {
    class Link extends Component {
      on = true;

      render() {
        return <a href={this.on ? '/next' : undefined} id={this.on ? 'link' : undefined}>go</a>;
      }
    }

    const [view, root] = mount(Link);
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

    const [view, root] = mount(Form);
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
    place(<ul ref={(node) => { if (node) count = node.children.length; }}><li /><li /></ul>);

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

    const [view, root] = mount(View);

    view.raw = true;
    await flushMicrotasks();
    expect(root.querySelector('div')!.innerHTML).toBe('<i>raw</i>');
  });

  it('will type SVG attributes and custom properties', () => {
    const root = place(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" style={{ '--tone': 'red' }}>
        <path d="M0 0L10 10" fill="none" stroke="red" transform="scale(1)" />
      </svg>
    );

    const path = root.querySelector('path')!;
    expect(path.getAttribute('d')).toBe('M0 0L10 10');
    expect(path.getAttribute('stroke')).toBe('red');
    expect(root.querySelector('svg')!.style.getPropertyValue('--tone')).toBe('red');
  });

  it('will assign and remove settable properties on SVG elements', async () => {
    class Dial extends Component {
      on = true;

      render() {
        return <svg tabIndex={this.on ? 0 : undefined} viewBox="0 0 10 10" />;
      }
    }

    const [dial, root] = mount(Dial);
    const svg = root.querySelector('svg')!;

    expect(svg.getAttribute('tabindex')).toBe('0');
    expect(svg.hasAttribute('tabIndex')).toBe(false);
    expect(svg.getAttribute('viewBox')).toBe('0 0 10 10');

    dial.on = false;
    await flushMicrotasks();
    expect(svg.hasAttribute('tabindex')).toBe(false);
  });

  it('will write contentEditable as an enumerated attribute', () => {
    const root = place(<><div contentEditable={false} /><div contentEditable={true} /></>);
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

    const [flags, root] = mount(Flags);
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

    const detached = place(<input autofocus />);
    const [editor, root] = mount(Editor, {}, document.body.appendChild(document.createElement('main')));

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

    const root = place(<Name />, document.body.appendChild(document.createElement('main')));
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

    const root = place(<Name />, document.body.appendChild(document.createElement('main')));
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

    const root = place(<Form />, document.body.appendChild(document.createElement('main')));
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
    const root = place(<><input value="fixed" /><input type="checkbox" checked={false} /><input /><input type="range" value={150} max={200} /><select value="b"><option value="a" /><option value="b" /></select></>, document.body.appendChild(document.createElement('main')));
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
});
