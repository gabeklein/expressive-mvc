import { describe, expect, it } from 'vitest';

import { Component, set } from '@expressive/mvc';

import { hydrate, Portal, render, style } from '../index';
import { renderToString } from '../server';
import { flushMicrotasks, mockPromise } from '../../test.setup';

async function served(node: () => any) {
  const { html } = await renderToString(node());
  const root = document.body.appendChild(document.createElement('main'));

  root.innerHTML = html;
  return root;
}

function rendered(node: any) {
  const root = document.createElement('main');
  const unmount = render(node, root);
  const html = root.innerHTML;

  unmount();
  return html;
}

describe('hydrate', () => {
  it('will adopt the server markup in place and bring it to life', async () => {
    class Counter extends Component {
      count = 0;

      render() {
        const { count, is } = this;

        return (
          <section>
            <h1 title="count">Count is {count}</h1>
            <button onClick={() => is.count++}>{''}add</button>
            {[<i key="a">a</i>, <i key="b">b</i>]}
          </section>
        );
      }
    }

    style(Counter, { _h1: { color: 'red' } });

    const root = await served(() => <Counter />);
    const before = root.innerHTML;
    const heading = root.querySelector('h1')!;
    const text = heading.firstChild!;
    const unmount = hydrate(<Counter />, root);

    expect(root.innerHTML).toBe(before);
    expect(root.querySelector('h1')).toBe(heading);
    expect(heading.firstChild).toBe(text);
    expect(heading.className).toBe('Counter_h1');

    root.querySelector('button')!.click();
    await flushMicrotasks();

    expect(heading.textContent).toBe('Count is 1');
    expect(root.querySelector('h1')).toBe(heading);

    unmount();
    expect(root.innerHTML).toBe('');
  });

  it('will replace what differs and drop markup the client does not render', async () => {
    const root = await served(() => (
      <div>
        <p>old</p>
        <b>stale</b>
        tail
      </div>
    ));
    const paragraph = root.querySelector('p')!;
    const client = (
      <div>
        <p>new</p>
        <span>{''}fresh</span>
      </div>
    );

    hydrate(client, root);

    expect(root.innerHTML).toBe(rendered(client));
    expect(root.querySelector('p')).toBe(paragraph);
  });

  it('will keep a suspended subtree on screen, then adopt it once it renders', async () => {
    const data = mockPromise<string>();

    class Post extends Component {
      body = set(() => data);

      render() {
        return <article>{this.body}</article>;
      }
    }

    class Page extends Component {
      fallback = <p>loading</p>;

      render() {
        return <main><Post /></main>;
      }
    }

    const root = document.body.appendChild(document.createElement('div'));
    root.innerHTML = '<!--fragment--><!--component--><main><!--component--><article>hello</article><!--/component--></main><!--/component--><!--/fragment-->';

    const article = root.querySelector('article')!;

    hydrate(<Page />, root);
    await flushMicrotasks();

    expect(root.textContent).toBe('hello');
    expect(root.querySelector('article')).toBe(article);

    data.resolve('hello');
    await flushMicrotasks();

    expect(root.querySelector('article')).toBe(article);
    expect(root.innerHTML).toContain('<article>hello</article>');
    expect(root.textContent).toBe('hello');
  });

  it('will keep suspended markup without any boundary, and drop what no longer renders after', async () => {
    const data = mockPromise<string>();

    class Lazy extends Component {
      value = set(() => data);

      render() {
        return <b>{this.value}</b>;
      }
    }

    const root = document.body.appendChild(document.createElement('div'));
    root.innerHTML = '<!--fragment--><!--component--><b>ok</b><i>gone</i><!--/component--><!--/fragment-->';

    hydrate(<Lazy />, root);
    expect(root.textContent).toBe('okgone');

    data.resolve('ok');
    await flushMicrotasks();

    expect(root.innerHTML).toBe('<!--fragment--><!--component--><b>ok</b><!--/component--><!--/fragment-->');
  });

  it('will adopt portal markers and hoist head elements fresh', async () => {
    const node = () => (
      <div>
        <title>Hydrated</title>
        <Portal into="body"><aside>away</aside></Portal>
      </div>
    );
    const root = await served(node);
    const markers = [...root.querySelector('div')!.childNodes];

    const unmount = hydrate(node(), root);

    expect([...root.querySelector('div')!.childNodes]).toEqual(markers);
    expect(document.title).toBe('Hydrated');
    expect(document.body.lastElementChild!.textContent).toBe('away');

    unmount();
  });

  it('will mend markup missing a closing marker or holding a foreign one', () => {
    const root = document.body.appendChild(document.createElement('div'));
    const client = <>{<p>one</p>}</>;

    root.innerHTML = '<!--fragment--><!--fragment--><p>one</p>';
    const unmount = hydrate(client, root);
    expect(root.innerHTML).toBe(rendered(client));
    unmount();

    root.innerHTML = '<!--fragment--><!--fragment--><p>one</p><!--/component--><!--/fragment-->';
    hydrate(client, root);
    expect(root.innerHTML).toBe(rendered(client));
  });
});
