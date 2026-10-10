/** @jsxImportSource preact */
import { act, render, screen } from '@testing-library/preact';
import { StrictMode, Suspense } from 'preact/compat';
import { expect, it, describe, vi } from 'vitest';

import { flushMicrotasks, mockPromise } from '../test.setup';
import { Component, pending, Provider, State } from '.';

describe('Component', () => {
  it('will expose a base render for class detection', () => {
    const { render } = Component.prototype as { render(props?: {}): unknown };

    expect(typeof render).toBe('function');
    expect(render({})).toBe(null);
  });

  it('will not expose React element marker', () => {
    expect(
      Object.getOwnPropertyDescriptor(Component.prototype, '$$typeof')
    ).toBeUndefined();
  });

  it('will throw rendering existing instance', () => {
    class Control extends Component {}

    const instance = Control.new({});
    const message =
      'Component instances cannot be rendered directly with @expressive/preact.';

    expect(() => render(<>{instance}</>)).toThrow(message);
    expect(() => render(<>{[instance]}</>)).toThrow(message);

    instance.set(null);
  });

  it('will not enumerate preact internals on instance', () => {
    class Control extends Component {
      foo = 'bar';
      baz = 123;
    }

    let instance!: Control;
    render(<Control is={(c) => (instance = c)} />);

    expect(Object.keys(instance).sort()).toEqual(['baz', 'foo']);
  });

  it('will construct then init once in strict mode', async () => {
    const order: string[] = [];

    class Control extends Component {
      constructor(props: any, ...rest: any[]) {
        super(props, ...rest);
        order.push('construct');
      }
    }

    Control.on({ setup: () => void order.push('init') });

    render(
      <StrictMode>
        <Control />
      </StrictMode>
    );

    await flushMicrotasks();

    expect(order).toEqual(['construct', 'init']);
  });
});

describe('Provider', () => {
  it('will mount an instance it creates', () => {
    const didMount = vi.fn();
    const didUnmount = vi.fn();

    class Test extends State {
      mount() {
        didMount();
        return didUnmount;
      }
    }

    const rendered = render(
      <Provider for={Test}>
        <span />
      </Provider>
    );

    expect(didMount).toBeCalledTimes(1);
    expect(didUnmount).not.toBeCalled();

    rendered.unmount();

    expect(didUnmount).toBeCalledTimes(1);
  });

  it('will settle when pending work falls back without a scheduler', async () => {
    class Test extends State {
      value = 'a';
    }

    const test = Test.new();
    const gate = mockPromise<void>();
    let ready = false;
    let settled = false;

    gate.then(() => (ready = true));

    const Content = () => {
      const { value } = Test.get();

      if (value === 'b' && !ready) throw gate;
      return <span>{value}</span>;
    };

    render(
      <Provider for={test}>
        <Suspense fallback={<i>loading</i>}>
          <Content />
        </Suspense>
      </Provider>
    );

    pending(() => void (test.value = 'b')).then(() => (settled = true));
    await flushMicrotasks();

    expect(screen).toHaveText('loading');
    expect(settled).toBe(true);

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(screen).toHaveText('b');
  });
});
