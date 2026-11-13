import { describe, expect, it, vi } from 'vitest';

import { Component } from '@expressive/mvc';
import { Portal, render } from '../index';
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
});

describe('head elements', () => {
  it('will hoist a title ahead of the document title, and restore it on unmount', async () => {
    const shell = document.createElement('title');
    shell.textContent = 'Shell';
    document.head.append(shell);

    class Page extends Component {
      name = 'One';
      order = ['a', 'b'];

      render() {
        return (
          <main>
            {this.order.map((key) => <p key={key}>{key}</p>)}
            <title key="t">{`Page ${this.name}`}</title>
          </main>
        );
      }
    }

    const [page, root, release] = mount(Page);

    expect(document.title).toBe('Page One');
    expect(root.innerHTML).toContain('<main><p>a</p><p>b</p><!--portal--></main>');

    page.name = 'Two';
    page.order = ['b', 'a'];
    await flushMicrotasks();
    expect(document.title).toBe('Page Two');
    expect(root.querySelector('title')).toBeNull();

    release();
    expect(document.title).toBe('Shell');
    shell.remove();
  });

  it('will let the latest title win, and append meta and link', () => {
    const unmount = render(
      <div>
        <title>Outer</title>
        <section><title>Inner</title></section>
        <meta name="description" content="about" />
        <link rel="canonical" href="/x" />
      </div>,
      document.body.appendChild(document.createElement('main'))
    );

    expect(document.title).toBe('Inner');
    expect(document.head.querySelector('meta[name=description]')!.getAttribute('content')).toBe('about');
    expect(document.head.lastElementChild!.outerHTML).toBe('<link rel="canonical" href="/x">');

    unmount();
    expect(document.head.querySelector('meta[name=description], link[rel=canonical], title')).toBeNull();
  });

  it('will keep an svg title in place, but not one in foreignObject', () => {
    const root = document.body.appendChild(document.createElement('main'));
    const unmount = render(<svg><title>icon</title><foreignObject><title>page</title></foreignObject></svg>, root);

    expect(root.querySelector('svg > title')!.textContent).toBe('icon');
    expect(document.title).toBe('page');
    unmount();
  });
});
