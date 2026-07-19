import { render, screen, act } from '@testing-library/react';
import { expect, it, describe } from 'bun:test';
import React from 'react';

import { mockError } from '../test.setup';
import { Component, Consumer } from '.';

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
