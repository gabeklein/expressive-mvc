import { afterEach, describe, expect, it, vi } from 'vitest';

import { Component, get, has, map, Model, set } from '@expressive/mvc';

import { createElement, Css, Fragment, Portal, render, style } from './index';
import { renderToString } from './server';
import { flushMicrotasks, mount } from '../test.setup';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function serve(node: any) {
  vi.stubGlobal('document', undefined);

  try {
    return await renderToString(node);
  } finally {
    vi.unstubAllGlobals();
  }
}

async function parity(node: () => any) {
  const root = document.body.appendChild(document.createElement('main'));
  const unmount = render(node(), root);
  const expected = root.innerHTML;

  unmount();
  root.remove();

  const { html } = await serve(node());

  expect(html).toBe(expected);
  return html;
}

describe('renderToString', () => {
  it('will render elements, text and attributes as render() leaves them', async () => {
    const html = await parity(() => (
      <section id="a" title={'say "hi" & <go>'} hidden tabIndex={0} aria-hidden={false} data-n={2} draggable spellcheck={false}>
        {'1 < 2 & 3 > 2'}
        {null}
        {undefined}
        {true}
        {[<b key="x">x</b>, 0n, 4]}
        <br />
        <label htmlFor="name">name</label>
        <button disabled={false}>go</button>
      </section>
    ));

    expect(html).toContain('<br>');
    expect(html).toContain('1 &lt; 2 &amp; 3 &gt; 2');
  });

  it('will render components, fragments and collections with their markers', async () => {
    class Counter extends Component {
      count = 2;

      render() {
        return <span>{this.count}</span>;
      }
    }

    class Item extends Component {
      name = '';

      render() {
        return <li>{this.name}</li>;
      }
    }

    class Lists extends Component {
      list = has(['one']);
      pool = has(Item);
      values = map<string, string>([['a', 'A']]);

      render() {
        return <>{this.list}<ul>{this.pool}</ul>{this.values}</>;
      }
    }

    function Greeting(props: { name: string }) {
      return <>hi {props.name}</>;
    }

    const html = await parity(() => (
      <div>
        <Greeting name="you" />
        <Counter count={3} />
        <Fragment><i>f</i></Fragment>
        <Lists />
      </div>
    ));

    expect(html).toBe(
      '<!--fragment--><div><!--function--><!--fragment-->hi you<!--/fragment--><!--/function-->' +
      '<!--component--><span>3</span><!--/component--><!--fragment--><i>f</i><!--/fragment-->' +
      '<!--component--><!--fragment--><!--collection-->one<!--/collection--><ul><!--collection--><!--/collection--></ul>' +
      '<!--collection-->A<!--/collection--><!--/fragment--><!--/component--></div><!--/fragment-->'
    );
  });

  it('will render a component instance and a Model unwrapped by the tracker', async () => {
    class Note extends Component {
      text = 'kept';

      render() {
        return <p>{this.text}</p>;
      }
    }

    const note = Note.new();
    const { html } = await serve(<main>{note}</main>);

    expect(html).toBe('<!--fragment--><main><!--component--><p>kept</p><!--/component--></main><!--/fragment-->');
  });

  it('will resolve context between components', async () => {
    class Theme extends Model {
      color = 'red';
    }

    class Swatch extends Component {
      theme = get(Theme);

      render() {
        return <i>{this.theme.color}</i>;
      }
    }

    function Label() {
      const { color } = Theme.get();
      return <b>{color}</b>;
    }

    const html = await parity(() => (
      <Component for={Theme}>
        <Swatch />
        <Label />
      </Component>
    ));

    expect(html).toContain('<i>red</i>');
    expect(html).toContain('<b>red</b>');
  });

  it('will render svg attributes as written and foreignObject content as html', async () => {
    await parity(() => (
      <svg viewBox="0 0 2 2">
        <path d="M0 0" stroke-width="2" />
        <foreignObject><div tabIndex={1}>html</div></foreignObject>
      </svg>
    ));
  });

  it('will write style classes and declarations, emitting their rules', async () => {
    function Card(props: { _active?: boolean; children?: any }) {
      return (
        <div _active={props._active} style={{ marginTop: 4, zIndex: 2, '--gap': '1px', color: null }}>
          {props.children}
        </div>
      );
    }

    style(Card, {
      _active: { fontWeight: 700 },
      _div: { padding: '4px' },
      color: 'blue'
    });

    const html = await parity(() => <Card _active>card</Card>);
    const { css } = await serve(<Card _active>card</Card>);

    expect(html).toContain('class="Card_div Card_active Card"');
    expect(css).toBe([
      '.Card{color: blue;}',
      '.Card_active{font-weight: 700;}',
      '.Card_div{padding: 4px;}'
    ].join('\n'));
  });

  it('will size numbers by property and include root variables', async () => {
    class Pack extends Css {
      $tone = 'red';
    }

    const styled = Pack.use();

    function Box() {
      return <div>box</div>;
    }

    styled(Box, ($) => ({ marginTop: 4, lineHeight: 1.5, opacity: 0, webkitLineClamp: 2, cssFloat: 'left', color: $.tone }));

    const { css, html } = await serve(<Box />);

    expect(html).toBe('<!--fragment--><!--function--><div class="Box">box</div><!--/function--><!--/fragment-->');
    expect(css).toBe(
      '.Box{margin-top: 4px; line-height: 1.5; opacity: 0; -webkit-line-clamp: 2; float: left; color: var(--tone);}\n' +
      ':where(:root){--tone: red;}'
    );
  });

  it('will write form state as attributes and raw text as is', async () => {
    const { html } = await serve(
      <form>
        <input value={'a"b'} checked defaultValue="x" onInput={() => {}} />
        <input {...{ value: null } as any} checked={false} />
        <textarea value="t<" />
        <textarea>kept</textarea>
        <select><option selected>o</option></select>
        <style>{'a > b {}'}{[' i', null, false]}</style>
        <div dangerouslySetInnerHTML={{ __html: '<b>raw</b>' }} />
        <div {...{ dangerouslySetInnerHTML: {} } as any} />
        <Portal into="body"><p>away</p></Portal>
      </form>
    );

    expect(html).toBe(
      '<!--fragment--><form><input value="x" value="a&quot;b" checked=""><input>' +
      '<textarea>t&lt;</textarea><textarea>kept</textarea><select><option selected="">o</option></select>' +
      '<style>a > b {} i</style><div><b>raw</b></div><div></div><!--portal--></form><!--/fragment-->'
    );
  });

  it('will await a suspended render and retry it in place', async () => {
    class Data extends Component {
      value = set(async () => 'loaded');
      renders = 0;

      render() {
        this.renders++;
        return <p>{this.value}</p>;
      }
    }

    const { html } = await serve(<Data />);

    expect(html).toContain('<p>loaded</p>');
  });

  it('will await a lazy component', async () => {
    function Page() {
      return <h1>page</h1>;
    }

    const Lazy = () => Promise.resolve({ default: Page });
    const { html } = await serve(<Lazy />);

    expect(html).toBe('<!--fragment--><!--function--><!--function--><h1>page</h1><!--/function--><!--/function--><!--/fragment-->');
  });

  it('will let a catch boundary handle an error once, then render again', async () => {
    let fail = true;

    function Risky() {
      if (fail) throw 'broke';
      return <p>fine</p>;
    }

    class Shell extends Component {
      error = '';

      catch(error: Error) {
        this.error = error.message;
        fail = false;
      }

      render() {
        return <main>{this.error}<Risky /></main>;
      }
    }

    const { html } = await serve(<Shell />);

    expect(html).toContain('<main>broke<!--function--><p>fine</p>');
  });

  it('will use a placement catch and propagate a second error', async () => {
    const handled = vi.fn();

    function Broken(): any {
      throw new Error('again');
    }

    await expect(serve(<Component catch={handled}><Broken /></Component>)).rejects.toThrow('again');
    expect(handled).toHaveBeenCalledOnce();
    await expect(serve(<Broken />)).rejects.toThrow('again');
  });

  it('will run new() but not effects, and will destroy what it built', async () => {
    const effect = vi.fn();
    const destroyed = vi.fn();

    class Quiet extends Component {
      new() {
        this.get(effect);
        return destroyed;
      }

      render() {
        return <p>quiet</p>;
      }
    }

    await serve(<Quiet />);

    expect(effect).not.toHaveBeenCalled();
    expect(destroyed).toHaveBeenCalledOnce();

    const [, root] = mount(Quiet);

    await flushMicrotasks();
    expect(effect).toHaveBeenCalled();
    root.remove();
  });

  it('will throw for what it cannot render', async () => {
    class Plain extends Model {}

    await expect(serve(Plain.new() as any)).rejects.toThrow('Plain is a Model');
    await expect(serve(createElement(Plain as any))).rejects.toThrow('Plain is a Model');
    await expect(serve({} as any)).rejects.toThrow('Cannot render [object Object].');
    await expect(serve(createElement(Symbol.iterator as any))).rejects.toThrow('Cannot render Symbol(Symbol.iterator).');
  });
});
