import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, describe, vi, type MockInstance } from 'vitest';
import React, { Suspense } from 'react';

import { mockPromise, revisions } from '../test.setup';
import { Component, Provider, State, get, has, map } from '.';
import { pending } from '@expressive/mvc';

let error: MockInstance<Console['error']>;

beforeEach(() => {
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  const { calls } = error.mock;

  error.mockRestore();

  expect(calls).toEqual([]);
});

class Item extends Component {
  label = '';

  render() {
    return <span>{this.key}={this.label};</span>;
  }
}

/** Component holding `field()` as `items`, rendering them through `render`. */
function holder<T>(field: () => T, render: (items: T) => React.ReactNode = (items) => <>{items}</>) {
  return class Store extends Component {
    items = field();

    render() {
      return render(this.items);
    }
  };
}

describe('instance element', () => {
  class Control extends Component {
    value = '';

    render() {
      return <span>{this.value}</span>;
    }
  }

  it('will render an existing instance', async () => {
    const instance = Control.new({ value: 'first' });
    const element = render(<>{instance}</>, { reactStrictMode: true });

    expect(React.isValidElement(instance)).toBe(true);
    expect((instance as any).$$typeof).toBe(
      (React.createElement('template') as any).$$typeof
    );
    expect((instance as any).key).toBe(String(instance));
    expect(screen).toHaveText('first');

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen).toHaveText('second');

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will activate a plain-constructed instance', async () => {
    const instance = new Control({ value: 'first' });

    render(<>{instance}</>);

    expect(screen).toHaveText('first');

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen).toHaveText('second');
  });

  it('will use an overridden key', () => {
    class Custom extends Control {
      override readonly key = 'custom';
    }

    const instance = Custom.new({});

    expect(React.isValidElement(instance)).toBe(true);
    expect(instance.key).toBe('custom');
  });

  it('will render an array', async () => {
    const first = Control.new({ value: 'foo' });
    const second = Control.new({ value: 'bar' });
    const collection = [first, second];
    const element = render(<>{collection}</>);

    expect(element.container.textContent).toBe('foobar');
    expect((first as any)._store).not.toBe((second as any)._store);

    await act(async () => {
      first.value = 'baz';
      second.value = 'qux';
    });

    expect(element.container.textContent).toBe('bazqux');

    element.unmount();

    expect(first.get(null)).toBe(false);
    expect(second.get(null)).toBe(false);
  });

  it('will render one instance in multiple places', async () => {
    const instance = Control.new({ value: 'first' });
    const element = render(
      <>
        <section>{instance}</section>
        <aside>{instance}</aside>
      </>
    );

    expect(screen.getAllByText('first')).toHaveLength(2);

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen.getAllByText('second')).toHaveLength(2);

    element.rerender(<>{instance}</>);

    expect(screen.getAllByText('second')).toHaveLength(1);

    await act(async () => {
      instance.value = 'third';
    });

    expect(screen.getAllByText('third')).toHaveLength(1);

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will render an owned collection through its owner', async () => {
    class Item extends Component {
      value = '';

      render() {
        return <span>{this.value}</span>;
      }
    }

    class Owner extends Component {
      items = [Item.new({ value: 'a' }), Item.new({ value: 'b' })];

      remove(item: Item) {
        item.set(null);
        this.items = this.items.filter((x) => x !== item);
      }

      render() {
        return <>{this.items}</>;
      }
    }

    const owner = Owner.new({});
    const [first] = owner.items;
    const element = render(<>{owner}</>);

    expect(element.container.textContent).toBe('ab');

    await act(async () => {
      owner.items = [...owner.items, Item.new({ value: 'c' })];
    });

    expect(element.container.textContent).toBe('abc');

    await act(async () => {
      owner.remove(first);
    });

    expect(element.container.textContent).toBe('bc');
    expect(first.get(null)).toBe(true);

    element.unmount();

    for (const item of owner.items)
      expect(item.get(null)).toBe(false);
  });

  it.each([
    ['spread', (items: Iterable<Item>) => <>{[...items]}</>, (_: unknown, item: Item) => item.set(null)],
    ['placed directly', undefined, (store: any, item: Item) => store.items.delete(item)]
  ])('will render a spawned collection %s', async (_, view, remove) => {
    const Store = holder(() => has(Item), view);
    const store = Store.new({});
    const first = store.items.add({ key: 'a' });
    const element = render(<>{store}</>);

    expect(first.key).toBe('a');
    expect(element.container.textContent).toBe('a=;');

    await act(async () => {
      first.label = 'apple';
    });

    expect(element.container.textContent).toBe('a=apple;');

    await act(async () => {
      store.items.add({ key: 'b' }).label = 'berry';
    });

    expect(element.container.textContent).toBe('a=apple;b=berry;');

    await act(async () => remove(store, first));

    expect(element.container.textContent).toBe('b=berry;');
    expect(first.get(null)).toBe(true);
  });

  it('will resolve provided context from spawned member', async () => {
    class Theme extends State {
      color = '';
    }

    class Item extends Component {
      theme = get(Theme);

      render() {
        return <span>{this.theme.color}</span>;
      }
    }

    class Store extends Component {
      items = has(Item);

      render() {
        return <>{[...this.items]}</>;
      }
    }

    let store!: Store;
    let item!: Item;

    const element = render(
      <Provider for={Theme} color="red">
        <Store is={(x) => (store = x)} />
      </Provider>
    );

    await act(async () => {
      item = store.items.add({ key: 'a' });
    });

    expect(item.theme.color).toBe('red');
    expect(screen.getByText('red')).toBeDefined();

    element.unmount();

    expect(item.get(null)).toBe(true);
  });

  it('will render a parent-owned instance', async () => {
    class Item extends Component {
      owner = get(Owner);
      value = '';

      render() {
        return <span>{this.value}</span>;
      }
    }

    class Owner extends State {
      item = new Item({ value: 'a' });
    }

    const owner = Owner.new({});
    const { item } = owner;

    expect(item.owner).toBe(owner);

    const element = render(<>{item}</>);

    expect(element.container.textContent).toBe('a');

    await act(async () => {
      item.value = 'b';
    });

    expect(element.container.textContent).toBe('b');

    await act(async () => {
      owner.set(null);
    });

    expect(item.get(null)).toBe(true);
  });

  it('will keep a child placement across owner renders', async () => {
    class Child extends Component {
      value = 'a';

      render() {
        return <span>{this.value}</span>;
      }
    }

    class Owner extends Component {
      label = '';
      child = new Child({});

      render() {
        return (
          <>
            <i>{this.label}</i>
            {this.child}
          </>
        );
      }
    }

    const owner = Owner.new({});
    const { child } = owner;
    const element = render(<>{owner}</>);

    expect(element.container.textContent).toBe('a');

    await act(async () => {
      owner.label = '!';
    });

    expect(child.get(null)).toBe(false);

    await act(async () => {
      child.value = 'b';
    });

    expect(element.container.textContent).toBe('!b');
  });

  it('will warn when rendering one instance twice as siblings', () => {
    const instance = Control.new({ value: 'first' });

    render(<>{[instance, instance]}</>);

    expect(error.mock.calls.flat().join(' ')).toContain('same key');

    error.mockClear();
  });

  it('will render again after unmount', async () => {
    const instance = Control.new({ value: 'first' });
    const first = render(<>{instance}</>);

    expect(screen.getAllByText('first')).toHaveLength(1);

    first.unmount();

    expect(instance.get(null)).toBe(false);

    const second = render(<>{instance}</>);

    expect(screen.getAllByText('first')).toHaveLength(1);

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen.getAllByText('second')).toHaveLength(1);

    second.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will not mount a placed instance', () => {
    const didMount = vi.fn();

    class Test extends Component {
      mount() {
        didMount();
      }

      render() {
        return <span>hello</span>;
      }
    }

    const instance = Test.new();
    const element = render(
      <>
        <section>{instance}</section>
        <aside>{instance}</aside>
      </>
    );

    expect(didMount).not.toBeCalled();

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will resolve ancestor provided at placement', async () => {
    class Theme extends State {
      color = '';
    }

    class Swatch extends Component {
      theme = get(Theme);

      render() {
        return <span>{this.theme.color}</span>;
      }
    }

    class Slot extends Component {
      render() {
        return <Swatch />;
      }
    }

    const instance = Slot.new({});
    const element = render(
      <>
        <Provider for={Theme} color="red">
          <section>{instance}</section>
        </Provider>
        <Provider for={Theme} color="blue">
          <aside>{instance}</aside>
        </Provider>
      </>
    );

    expect(screen.getByText('red')).toBeDefined();
    expect(screen.getByText('blue')).toBeDefined();

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will resolve its own context per placement', async () => {
    function Value() {
      return <span>{Item.get().value}</span>;
    }

    class Item extends Component {
      value = '';

      render() {
        return <Value />;
      }
    }

    const instance = Item.new({ value: 'a' });

    const View = ({ both }: { both: boolean }) => (
      <>
        {both && <section>{instance}</section>}
        <aside>{instance}</aside>
      </>
    );

    const element = render(<View both />);

    expect(screen.getAllByText('a')).toHaveLength(2);

    element.rerender(<View both={false} />);

    expect(screen.getAllByText('a')).toHaveLength(1);

    await act(async () => {
      instance.value = 'b';
    });

    expect(screen.getAllByText('b')).toHaveLength(1);

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });
});

describe('repeated placement of a child field', () => {
  class Panel extends Component {
    text = '';

    get count() {
      return this.text.trim() ? this.text.trim().split(/\s+/).length : 0;
    }

    render() {
      const { text, count } = this;

      return (
        <i>
          <b data-testid="len">{text.length}</b>
          <u data-testid="count">{count}</u>
          <textarea
            data-testid="input"
            value={text}
            onChange={(e) => (this.text = e.target.value)}
          />
        </i>
      );
    }
  }

  /**
   * Type into the panel, read what it rendered, then detach and reattach it -
   * five times. Writes land in an event handler, where the owner's `this` is a
   * render proxy.
   */
  async function cycle() {
    const seen: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const text = Array.from({ length: i }, (_, n) => `w${n}`).join(' ');

      await act(async () => {
        fireEvent.change(screen.getByTestId('input'), { target: { value: text } });
      });

      seen.push(
        `${screen.getByTestId('len').textContent}/${
          screen.getByTestId('count').textContent
        }`
      );

      await act(async () => {
        fireEvent.click(screen.getByText('off'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('on'));
      });
    }

    return seen;
  }

  const expected = ['2/1', '5/2', '8/3', '11/4', '14/5'];

  /** Host which toggles `panel` in and out of its render. */
  function host(panel: () => Panel) {
    return class Host extends Component {
      panel = panel();
      active?: Panel = this.panel;

      render() {
        return (
          <>
            <button onClick={() => (this.active = this.panel)}>on</button>
            <button onClick={() => (this.active = undefined)}>off</button>
            <span>{this.active}</span>
          </>
        );
      }
    };
  }

  class Owned extends Component {
    shown = true;

    render() {
      return (
        <>
          <button onClick={() => (this.shown = true)}>on</button>
          <button onClick={() => (this.shown = false)}>off</button>
          <span>{this.shown ? <Panel /> : null}</span>
        </>
      );
    }
  }

  it.each([
    ['a plain-constructed instance', host(() => new Panel())],
    ['an activated instance', host(() => Panel.new())],
    ['an owned element', Owned]
  ])('will recompute for %s', async (_, Host) => {
    const instance: any = (Host as any).new();

    render(<>{instance}</>);

    expect(await cycle()).toEqual(expected);

    if (instance.panel) expect(Object.is(instance.is.active, instance.panel)).toBe(true);
  });
});

describe('map element', () => {
  it('will render a keyed map placed directly', async () => {
    class Store extends Component {
      items = map<string, Item>();

      render() {
        return <>{this.items}</>;
      }
    }

    const store = Store.new({});
    const first = Item.new({ key: 'a', label: 'apple' });
    store.items.set('a', first);
    const element = render(<>{store}</>);

    expect(element.container.textContent).toBe('a=apple;');

    await act(async () => {
      store.items.set('b', Item.new({ key: 'b', label: 'berry' }));
    });

    expect(element.container.textContent).toBe('a=apple;b=berry;');

    await act(async () => {
      store.items.delete('a');
    });

    expect(element.container.textContent).toBe('b=berry;');
  });

  it('will render a spawning map placed directly', async () => {
    class Store extends Component {
      items = map((key: string) => new Item({ key, label: key }));

      render() {
        return <>{this.items}</>;
      }
    }

    const store = Store.new({});
    store.items.set('a');
    const element = render(<>{store}</>);

    expect(element.container.textContent).toBe('a=a;');

    await act(async () => {
      store.items.set('b');
    });

    expect(element.container.textContent).toBe('a=a;b=b;');
  });

});

describe('seam', () => {
  it('will seam host elements without a dev store', async () => {
    vi.resetModules();

    await import('.');

    const { Runtime } = await import('./runtime');
    const { seam } = await import('./element');
    const template = { $$typeof: Symbol.for('react.transitional.element') };

    vi.spyOn(Runtime, 'createElement').mockReturnValueOnce(template);

    const self = {} as any;
    const type = () => null;

    expect(seam(self, false, type, 'key')).toBe(template.$$typeof);
    expect(self.type).toBe(type);
    expect(self.key).toBe('key');
  });
});

describe('collection element', () => {
  let gate = mockPromise<void>();

  class Suspends extends Component {
    label = '';

    render() {
      if (this.label === 'wait') throw gate;
      return <span>{this.key}={this.label};</span>;
    }
  }

  it('will render a list placed directly', async () => {
    class Store extends Component {
      items = has([Item.new({ key: 'a', label: 'x' })]);

      render() {
        return <>{this.items}</>;
      }
    }

    const store = Store.new({});
    const element = render(<>{store}</>);

    expect(element.container.textContent).toBe('a=x;');

    await act(async () => {
      store.items.push(Item.new({ key: 'b', label: 'y' }));
    });

    expect(element.container.textContent).toBe('a=x;b=y;');
  });

  it.each([
    [
      'map',
      () => map<string, Suspends>(),
      (items: any) => items.set('a', Suspends.new({ key: 'a', label: 'ready' })),
      (items: any) => items.set('b', Suspends.new({ key: 'b', label: 'wait' })),
      (items: any) => items.delete('b')
    ],
    [
      'list',
      () => has<Suspends>(),
      (items: any) => items.push(Suspends.new({ key: 'a', label: 'ready' })),
      (items: any) => items.push(Suspends.new({ key: 'b', label: 'wait' })),
      (items: any) => items.pop()
    ]
  ])('will transition a direct %s subscriber', async (_, field, seed, add, remove) => {
    gate = mockPromise<void>();

    const Store = holder(field as () => any, (items) => <Suspense fallback={<i>loading</i>}>{items}</Suspense>);
    const store = Store.new({});

    seed(store.items);

    const element = render(<>{store}</>);

    await act(async () => {
      pending(() => add(store.items));
      await Promise.resolve();
    });

    expect(element.container.textContent).toBe('a=ready;');

    remove(store.items);
    gate.resolve();
    await act(async () => {});
  });

  it('will render the same collection in multiple places', async () => {
    class Store extends Component {
      items = has(Item);

      render() {
        return <>{this.items}{this.items}</>;
      }
    }

    const store = Store.new({});
    store.items.add({ key: 'a', label: 'z' });
    const element = render(<>{store}</>);

    expect(element.container.textContent).toBe('a=z;a=z;');
  });
});

describe('collection concurrent consistency', () => {
  it.each([
    ['pool', () => has(Item), (items: any, key: string) => items.add({ key, label: key })],
    ['map', () => map((key: string) => new Item({ key, label: key })), (items: any, key: string) => items.set(key)]
  ])('will not commit mixed revisions across repeated %s placements', async (_, field, add) => {
    const { commits, slow, reveal } = revisions(() => add(store.items, 'b'), 'div');

    function Slow() {
      slow();
      return null;
    }

    const Store = holder(field as () => any, (items) =>
      Array.from({ length: 40 }, (_, index) => (
        <div key={index}>
          <Slow />
          {items}
        </div>
      ))
    );

    const store = Store.new({});

    add(store.items, 'a');

    const view = reveal(<>{store}</>);

    await waitFor(() => {
      expect(commits[0]).toHaveLength(40);
    });

    expect(new Set(commits[0]).size).toBe(1);

    await waitFor(() => {
      expect(view.container.textContent).toBe('a=a;b=b;'.repeat(40));
    });
  });
});
