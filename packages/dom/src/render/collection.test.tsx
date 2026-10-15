import { describe, expect, it } from 'vitest';

import { Component, has, map } from '@expressive/mvc';
import { flushMicrotasks, mount, place } from '../../test.setup';

describe('collections', () => {
  it('will render MVC collections directly', async () => {
    const list = new has.List(['one']);
    const pool = new has.Pool((value: string) => value);
    const values = new map.Managed<string, string>([['a', 'A']]);
    pool.add('P');

    function Collections() {
      return <>{list}{pool}{values}</>;
    }

    const root = place(<Collections />);
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

    const [lists, root] = mount(Lists);
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

    const [list, root] = mount(Items);
    const [a, b] = root.querySelectorAll('li');

    list.tick++;
    await flushMicrotasks();
    expect([...root.querySelectorAll('li')]).toEqual([a, b]);

    [...list.items][1].order = 0;
    await flushMicrotasks();
    expect(root.textContent).toBe('ba');
    expect([...root.querySelectorAll('li')]).toEqual([b, a]);
  });
});
