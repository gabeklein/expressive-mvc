import { render, screen, act } from '@testing-library/react';
import { expect, it, describe } from 'bun:test';
import React from 'react';

import { mockError } from '../test.setup';
import { Component, Consumer, Provider, State, get } from '.';

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

  it('will use an overridden key', () => {
    class Custom extends Control {
      override readonly key = 'custom';
    }

    const instance = Custom.new({});

    expect(React.isValidElement(instance)).toBe(true);
    expect(instance.key).toBe('custom');
  });

  it('will render an array', async () => {
    const error = mockError();
    const first = Control.new({ value: 'foo' });
    const second = Control.new({ value: 'bar' });
    const collection = [first, second];
    const element = render(<>{collection}</>);

    expect(element.container.textContent).toBe('foobar');
    expect(error).not.toBeCalled();
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
    const error = mockError();
    const instance = Control.new({ value: 'first' });
    const element = render(
      <>
        <section>{instance}</section>
        <aside>{instance}</aside>
      </>
    );

    expect(screen.getAllByText('first')).toHaveLength(2);
    expect(error).not.toBeCalled();

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
    const error = mockError();

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
    expect(error).not.toBeCalled();

    element.unmount();

    for (const item of owner.items)
      expect(item.get(null)).toBe(false);
  });

  it('will render a parent-owned instance', async () => {
    const error = mockError();

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
    expect(error).not.toBeCalled();

    element.unmount();
  });

  it('will warn when rendering one instance twice as siblings', () => {
    const error = mockError();
    const instance = Control.new({ value: 'first' });
    const element = render(<>{[instance, instance]}</>);

    expect(error.mock.calls.flat().join(' ')).toContain('same key');

    element.unmount();
  });

  it('will keep a sibling placement when one unmounts', async () => {
    const error = mockError();
    const instance = Control.new({ value: 'first' });

    const View = ({ both }: { both: boolean }) => (
      <>
        {both && <section>{instance}</section>}
        <aside>{instance}</aside>
      </>
    );

    const element = render(<View both />);

    expect(screen.getAllByText('first')).toHaveLength(2);

    element.rerender(<View both={false} />);

    expect(screen.getAllByText('first')).toHaveLength(1);

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen.getAllByText('second')).toHaveLength(1);
    expect(instance.get(null)).toBe(false);
    expect(error).not.toBeCalled();

    element.unmount();

    expect(instance.get(null)).toBe(false);
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

  it('will resolve ancestor provided at placement', async () => {
    const error = mockError();

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
    expect(error).not.toBeCalled();

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will resolve its own context per placement', async () => {
    const error = mockError();

    class Item extends Component {
      value = '';

      render() {
        return <Consumer for={Item}>{(self) => <span>{self.value}</span>}</Consumer>;
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
    expect(error).not.toBeCalled();

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });
});
