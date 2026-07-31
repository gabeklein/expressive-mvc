import './jsx-runtime';

import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { createElement, Fragment as ReactFragment, Suspense, useState } from 'react';
import { childrenOf, Fragment, isElement, jsx, propsOf, transition, typeOf } from '@expressive/mvc/runtime';
import { State, use } from '.';
import { mockPromise } from '../test.setup';

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

  it('will hold prior content through a suspending State update', async () => {
    class Model extends State {
      value = 'a';
    }

    const model = Model.new();
    const pending = mockPromise<void>();
    const Content = ({ value }: { value: string }) => {
      if (value === 'b') throw pending;
      return <span>{value}</span>;
    };
    const App = () => {
      const { value } = use(model);
      return (
        <Suspense fallback={<i>loading</i>}>
          <Content value={value} />
        </Suspense>
      );
    };
    const { container } = render(<App />);

    expect(container.textContent).toBe('a');

    await act(async () => {
      transition(() => {
        model.value = 'b';
      });
      await Promise.resolve();
    });

    expect(container.textContent).toBe('a');

    model.value = 'c';
    pending.resolve();
    await act(async () => {});

    expect(container.textContent).toBe('c');
  });

  it('will squash stacked State updates into one transition', async () => {
    class Model extends State {
      value = 'a';
    }

    const model = Model.new();
    const pending = mockPromise<void>();
    const Content = ({ value }: { value: string }) => {
      if (value === 'c') throw pending;
      return <span>{value}</span>;
    };
    const App = () => {
      const { value } = use(model);
      return (
        <Suspense fallback={<i>loading</i>}>
          <Content value={value} />
        </Suspense>
      );
    };
    const { container } = render(<App />);

    await act(async () => {
      transition(() => {
        model.value = 'b';
        model.value = 'c';
      });
      await Promise.resolve();
    });

    expect(model.value).toBe('c');
    expect(container.textContent).toBe('a');

    model.value = 'd';
    pending.resolve();
    await act(async () => {});

    expect(container.textContent).toBe('d');
  });

  it('will carry a State transition through a cascading write', async () => {
    class Model extends State {
      source = 'a';
      presented = 'a';
    }

    const model = Model.new();
    const pending = mockPromise<void>();

    model.get(({ source }) => {
      model.presented = source;
    });

    const Content = ({ value }: { value: string }) => {
      if (value === 'b') throw pending;
      return <span>{value}</span>;
    };
    const App = () => {
      const { presented } = use(model);
      return (
        <Suspense fallback={<i>loading</i>}>
          <Content value={presented} />
        </Suspense>
      );
    };
    const { container } = render(<App />);

    await act(async () => {
      transition(() => {
        model.source = 'b';
      });
      await Promise.resolve();
    });

    expect(model.presented).toBe('b');
    expect(container.textContent).toBe('a');

    model.presented = 'c';
    pending.resolve();
    await act(async () => {});

    expect(container.textContent).toBe('c');
  });

  it('will preserve State priority through nested transitions', async () => {
    class Model extends State {
      value = 'a';
    }

    const model = Model.new();
    const pending = mockPromise<void>();
    const Content = ({ value }: { value: string }) => {
      if (value === 'b') throw pending;
      return <span>{value}</span>;
    };
    const App = () => {
      const { value } = use(model);
      return (
        <Suspense fallback={<i>loading</i>}>
          <Content value={value} />
        </Suspense>
      );
    };
    const { container } = render(<App />);

    await act(async () => {
      transition(() => {
        transition(() => {
          model.value = 'b';
        });
      });
      await Promise.resolve();
    });

    expect(container.textContent).toBe('a');

    model.value = 'c';
    pending.resolve();
    await act(async () => {});

    expect(container.textContent).toBe('c');
  });

  it('will let an urgent State invalidation replace deferred content', async () => {
    class Model extends State {
      value = 'a';
      urgent = 0;
    }

    const model = Model.new();
    const pending = mockPromise<void>();
    const Content = ({ value }: { value: string }) => {
      if (value === 'b') throw pending;
      return <span>{value}</span>;
    };
    const App = () => {
      const { value, urgent } = use(model);
      return (
        <Suspense fallback={<i>loading {urgent}</i>}>
          <Content value={value} />
        </Suspense>
      );
    };
    const { container } = render(<App />);

    await act(async () => {
      transition(() => {
        model.value = 'b';
      });
      model.urgent = 1;
      await Promise.resolve();
    });

    expect(container.textContent).toContain('loading 1');

    model.value = 'c';
    pending.resolve();
    await act(async () => {});

    expect(container.textContent).toBe('c');
  });
});
