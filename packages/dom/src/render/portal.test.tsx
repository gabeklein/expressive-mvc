import { describe, expect, it, vi } from 'vitest';

import { Component } from '@expressive/mvc';
import { Portal, render, style } from '../index';
import { flushMicrotasks, mockPromise, mount } from '../../test.setup';

describe('Portal', () => {
  it('will resolve a selector target once and move when it changes', async () => {
    const first = document.createElement('aside');
    const second = document.createElement('aside');
    const query = vi.spyOn(document, 'querySelectorAll');

    first.id = 'first';
    second.className = 'second';
    document.body.append(first, second);

    class Modal extends Component {
      message = 'open';
      target = '#first';

      render() {
        return <Portal into={this.target}><b>{this.message}</b></Portal>;
      }
    }

    const [modal, , release] = mount(Modal);

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

    class Page extends Component {
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

    const [modal, root, release] = mount(Modal);

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

  it('will carry anchors of its logical ancestors onto portalled roots', async () => {
    const layer = document.body.appendChild(document.createElement('aside'));

    function Menu() {
      return <ul __menu><li __option>one</li></ul>;
    }

    class Picker extends Component {
      open = true;

      render() {
        return <section>{this.open && <Portal into={layer}><Menu /><b /></Portal>}</section>;
      }
    }

    function Page() {
      return <main><Picker _wide /></main>;
    }

    style(Picker);
    style(Page, { __option: { color: 'red' }, _wide: { __menu: { color: 'blue' } } });

    const root = document.body.appendChild(document.createElement('div'));
    render(<Page />, root);

    expect(layer.querySelector('ul')!.className).toBe('__menu Page_wide-group Page-group');
    expect(layer.querySelector('b')!.className).toBe('Page_wide-group Page-group');

    const bare = document.body.appendChild(document.createElement('div'));
    bare.className = 'Page-group plain';
    render(<Portal into={layer}><i /></Portal>, bare);

    expect(layer.querySelector('i')!.className).toBe('Page-group');
  });

  it('will not carry classes that anchor no parts', () => {
    const layer = document.body.appendChild(document.createElement('aside'));
    const root = document.body.appendChild(document.createElement('div'));

    root.className = 'plain';
    render(<Portal into={layer}><i /></Portal>, root);

    expect(layer.querySelector('i')!.hasAttribute('class')).toBe(false);
  });
});
