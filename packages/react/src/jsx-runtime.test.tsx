import './jsx-runtime';

import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { createElement, Fragment as ReactFragment, Suspense, useState } from 'react';
import { childrenOf, Fragment, isElement, jsx, propsOf, transition, typeOf } from '@expressive/mvc/jsx-runtime';

const element = createElement('div', { id: 'foo' });

describe('host registration', () => {
  it('will create host elements', () => {
    const node = jsx('span', { children: 'hi' }) as React.ReactElement;

    expect(isElement(node)).toBe(true);
    expect(node.type).toBe('span');
  });

  it('will translate Fragment sentinel to host Fragment', () => {
    const node = jsx(Fragment, {}) as React.ReactElement;

    expect(node.type).toBe(ReactFragment);
    expect(typeOf(node)).toBe(Fragment);
  });
});

describe('introspection', () => {
  it('will flatten children', () => {
    const items = childrenOf(['a', ['b', element]]);

    expect(items).toHaveLength(3);
    expect(items[0]).toBe('a' as never);
  });

  it('will identify elements', () => {
    expect(isElement(element)).toBe(true);
    expect(isElement({ type: 'div' })).toBe(false);
  });

  it('will read element type', () => {
    expect(typeOf(element)).toBe('div');
    expect(typeOf('text')).toBeUndefined();
  });

  it('will read element props', () => {
    expect(propsOf(element)).toEqual({ id: 'foo' });
    expect(propsOf('text')).toEqual({});
  });
});

describe('transition', () => {
  function suspending() {
    const ready = new Set(['a']);
    const pending = new Map<string, Promise<void>>();

    const Content = ({ value }: { value: string }) => {
      if (!ready.has(value)) {
        let promise = pending.get(value);
        if (!promise) {
          promise = Promise.resolve().then(() => { ready.add(value); });
          pending.set(value, promise);
        }
        throw promise;
      }
      return <span>{value}</span>;
    };

    let update!: (value: string) => void;
    const App = () => {
      const [value, set] = useState('a');
      update = set;
      return (
        <Suspense fallback={<i>loading</i>}>
          <Content value={value} />
        </Suspense>
      );
    };

    return { App, update: (value: string) => update(value) };
  }

  it('will hold prior content through a suspending update', async () => {
    const { App, update } = suspending();
    const { container } = render(<App />);

    expect(container.textContent).toBe('a');

    act(() => transition(() => update('b')));
    expect(container.textContent).toBe('a');

    await act(async () => {});
    expect(container.textContent).toBe('b');
  });

  it('will show fallback when the update is not bracketed', async () => {
    const { App, update } = suspending();
    const { container } = render(<App />);

    act(() => update('b'));
    expect(container.textContent).toContain('loading');

    await act(async () => {});
    expect(container.textContent).toBe('b');
  });
});
