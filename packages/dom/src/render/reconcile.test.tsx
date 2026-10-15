import { describe, expect, it, vi } from 'vitest';

import { Component, Model } from '@expressive/mvc';
import { Fragment } from '../index';
import { flushMicrotasks, mount } from '../../test.setup';

function Pair({ value }: { value: string }) {
  return <><b>{value}</b><i>{value}</i></>;
}

describe('reconcile', () => {
  it('will render a child once when its parent re-renders it', async () => {
    class Count extends Model {
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

    const [app, root] = mount(App);
    renders.mockClear();

    app.count.value = 1;
    await flushMicrotasks();

    expect(renders.mock.calls).toEqual([[1]]);
    expect(root.textContent).toBe('11');
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

    const [parent, root] = mount(Parent);
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

  it.each([
    ['elements', (id: string) => <li key={id}>{id}</li>],
    ['fragments', (id: string) => <Fragment key={id}><dt>{id}</dt><dd>{id}</dd></Fragment>],
    ['component ranges', (id: string) => <Pair key={id} value={id} />]
  ])('will retain keyed %s while reordering', async (_, item) => {
    class List extends Component {
      order = ['a', 'b', 'c'];

      render() {
        return <section>{this.order.map(item)}</section>;
      }
    }

    const [list, root] = mount(List);
    const before = [...root.querySelector('section')!.children];

    list.order = ['c', 'a', 'b'];
    await flushMicrotasks();
    const after = [...root.querySelector('section')!.children];
    const expected = ['c', 'a', 'b'].flatMap((id) => before.filter((node) => node.textContent == id));

    expect(after).toHaveLength(expected.length);
    after.forEach((node, index) => expect(node).toBe(expected[index]));
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

    const [keys, root] = mount(Keys);
    keys.mode = 1;
    await flushMicrotasks();
    expect(root.textContent).toBe('twothree');

    keys.mode = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('plain');
  });
});
