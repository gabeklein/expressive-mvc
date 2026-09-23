import { act, render } from '@testing-library/react';
import { Activity, ReactNode, Suspense, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Component, pending, Provider, State } from '.';
import { mockPromise } from '../test.setup';
import { Runtime, useHook } from './runtime';

// Stub Runtime with a hand-driven lifecycle so a subscription update can fire
// before vs. after commit, and watch whether the React setter actually runs.
// useHook takes more than one ref (its own record, plus useSettle's) and
// registers more than one effect (mount, plus useSettle's release), so slots
// are handed out in call order and every effect runs on commit.
function harness() {
  const refs: { current: any }[] = [];
  let slot = 0;
  let inited = false;
  let state = 0;
  const effects: (() => (() => void) | void)[] = [];
  let refresh: (next?: any) => void;
  let reset: () => void;
  const unmount = vi.fn();

  // Apply the updater like React would, so the `(x) => x + 1` path is exercised.
  const update = vi.fn((fn: (prev: number) => number) => void (state = fn(state)));

  Runtime.useRef = ((value: any) => {
    const ref = refs[slot] || (refs[slot] = { current: value });
    slot++;
    return ref;
  }) as typeof Runtime.useRef;

  Runtime.useState = ((value: any) => {
    if (!inited) {
      inited = true;
      if (typeof value === 'function') value(); // run initializer (subscribes)
    }
    return [state, update];
  }) as typeof Runtime.useState;

  Runtime.useEffect = ((fn: any) => void effects.push(fn)) as typeof Runtime.useEffect;
  Runtime.useSyncExternalStore = undefined;

  let cleanups: ((() => void) | void)[] = [];

  return {
    update,
    unmount,
    render: () => {
      slot = 0;
      effects.length = 0;
      return useHook((r, x) => ((refresh = r), (reset = x), () => unmount));
    },
    commit: () => void (cleanups = effects.map((fn) => fn())),
    unwind: () => cleanups.forEach((fn) => fn && fn()),
    refresh: (next?: any) => refresh(next),
    reset: () => reset()
  };
}

let saved: Partial<typeof Runtime>;
beforeEach(() => void (saved = { ...Runtime }));
afterEach(() => void Object.assign(Runtime, saved));

it('does not call the setter before commit', () => {
  const { update, render, refresh } = harness();

  render();
  refresh('early'); // e.g. a sibling mutating shared state during render

  expect(update).not.toHaveBeenCalled();
});

it('coalesces deferred refreshes into a single flush on commit', () => {
  const { update, render, commit, refresh } = harness();

  render();
  refresh('a');
  refresh('b');
  expect(update).not.toHaveBeenCalled();

  commit();
  expect(update).toHaveBeenCalledTimes(1);
});

it('refreshes immediately for updates after commit', () => {
  const { update, render, commit, refresh } = harness();

  render();
  commit();
  update.mockClear();

  refresh('later');
  expect(update).toHaveBeenCalledTimes(1);
});

it('runs the callback cleanup on unmount', () => {
  const { render, commit, unwind, unmount } = harness();

  render();
  commit();
  expect(unmount).not.toHaveBeenCalled();

  unwind();
  expect(unmount).toHaveBeenCalledTimes(1);
});

it('will advance revision on reset', () => {
  const { render, reset } = harness();
  let getRevision!: () => number;

  Runtime.useSyncExternalStore = (_subscribe, get) => (getRevision = get)();

  render();
  expect(getRevision()).toBe(0);

  reset();
  expect(getRevision()).toBe(1);

  render();
  expect(getRevision()).toBe(1);
});




describe('pending', () => {
  class Data extends State {
    value = 'a';
  }

  /** A screen which suspends on `b` until its gate resolves. */
  function scenario() {
    const gate = mockPromise<void>();
    const data = Data.new();
    let ready = false;

    gate.then(() => {
      ready = true;
    });

    const Screen = () => {
      const { value } = Data.get();

      if (value === 'b' && !ready) throw gate;

      return <span>{value}</span>;
    };

    const Content = () => (
      <Suspense fallback={<i>fallback</i>}>
        <Screen />
      </Suspense>
    );

    return { gate, data, Content };
  }

  it('will hold current content until the replacement is absorbed', async () => {
    const { gate, data, Content } = scenario();
    let shell!: Shell;

    class Shell extends Component {
      busy = false;

      go(work: () => void) {
        this.busy = true;
        return pending(work).then(() => {
          this.busy = false;
        });
      }

      render() {
        return <Content />;
      }
    }

    const view = render(
      <Provider for={data}>
        <Shell is={(i) => (shell = i)} />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      shell.go(() => {
        data.value = 'b';
      });
      await Promise.resolve();
    });

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('a');
    expect(shell.busy).toBe(true);

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('b');
    expect(shell.busy).toBe(false);
  });

  it('will hold for a plain State, with no Component involved', async () => {
    const { gate, data, Content } = scenario();
    let busy = true;

    const view = render(
      <Provider for={data}>
        <Content />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      pending(() => {
        data.value = 'b';
      }).then(() => (busy = false));
      await Promise.resolve();
    });

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('a');
    expect(busy).toBe(true);

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('b');
    expect(busy).toBe(false);
  });

  it('will release a claim when its subscriber is hidden mid-flight', async () => {
    const { gate, data, Content } = scenario();
    let settled = false;
    let hide!: () => void;

    const App = () => {
      const [mode, set] = useState<'visible' | 'hidden'>('visible');
      hide = () => set('hidden');
      return (
        <Activity mode={mode}>
          <Content />
        </Activity>
      );
    };

    render(
      <Provider for={data}>
        <App />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      pending(() => {
        data.value = 'b';
      }).then(() => (settled = true));
      await Promise.resolve();
    });

    expect(settled).toBe(false);

    await act(async () => hide());

    expect(settled).toBe(true);

    gate.resolve();
  });

  it('will not claim for a subscriber which is already hidden', async () => {
    const { data, Content } = scenario();
    let settled = false;

    render(
      <Provider for={data}>
        <Activity mode="hidden">
          <Content />
        </Activity>
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      pending(() => {
        data.value = 'b';
      }).then(() => (settled = true));
      await Promise.resolve();
    });

    expect(settled).toBe(true);
  });

  it('will hold every reader while one of them suspends', async () => {
    const gate = mockPromise<void>();
    const data = Data.new();
    let ready = false;

    gate.then(() => (ready = true));

    const Slow = () => {
      const { value } = Data.get();
      if (value === 'b' && !ready) throw gate;
      return <span>{value}</span>;
    };

    const Fast = () => <b>{Data.get().value}</b>;

    const view = render(
      <Provider for={data}>
        <Fast />
        <Suspense fallback={<i>fallback</i>}>
          <Slow />
        </Suspense>
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      pending(() => {
        data.value = 'b';
      });
      await Promise.resolve();
    });

    // React entangles a transition - it will not commit the reader which is
    // ready while its sibling is suspended.
    expect(view.container.textContent).toBe('aa');

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('bb');
  });

  it('will wait on every reader, not the first', async () => {
    const { gate, data, Content } = scenario();
    const seen: string[] = [];
    let settled = false;

    data.get(({ value }) => void seen.push(value));

    render(
      <Provider for={data}>
        <Content />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      pending(() => {
        data.value = 'b';
      }).then(() => (settled = true));
      await Promise.resolve();
    });

    expect(seen).toEqual(['a', 'b']);
    expect(settled).toBe(false);

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(settled).toBe(true);
  });

  it('will settle on dispatch before mount', async () => {
    const data = Data.new();
    let settled = false;

    await pending(() => {
      data.value = 'b';
    }).then(() => {
      settled = true;
    });

    expect(settled).toBe(true);
  });

  it('will track pending from a sibling', async () => {
    const { gate, data, Content } = scenario();
    let shell!: Shell;

    const Status = () => <b>{Shell.get().pending ? 'busy' : 'idle'}</b>;

    class Shell extends Component {
      pending = false;

      go(to: string) {
        this.pending = true;
        pending(() => {
          data.value = to;
        }).then(() => {
          this.pending = false;
        });
      }

      render() {
        return (
          <>
            <Status />
            <Content />
          </>
        );
      }
    }

    const view = render(
      <Provider for={data}>
        <Shell is={(i) => (shell = i)} />
      </Provider>
    );

    await act(async () => {});

    expect(view.container.textContent).toBe('idlea');

    await act(async () => {
      shell.go('b');
      await Promise.resolve();
    });

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('busya');

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('idleb');
  });

  it('will disable outgoing content without collapsing it', async () => {
    const { gate, data, Content } = scenario();
    let shell!: Shell;

    const Lock = ({ children }: { children: ReactNode }) => (
      <fieldset disabled={Shell.get().pending}>{children}</fieldset>
    );

    class Shell extends Component {
      pending = false;

      go(to: string) {
        this.pending = true;
        pending(() => {
          data.value = to;
        }).then(() => {
          this.pending = false;
        });
      }

      render() {
        return (
          <Lock>
            <Content />
          </Lock>
        );
      }
    }

    const view = render(
      <Provider for={data}>
        <Shell is={(i) => (shell = i)} />
      </Provider>
    );

    await act(async () => {});

    const lock = () => view.container.querySelector('fieldset')!;

    expect(view.container.textContent).toBe('a');
    expect(lock().disabled).toBe(false);

    await act(async () => {
      shell.go('b');
      await Promise.resolve();
    });

    // The wrapper re-renders urgently and locks down; its child is the element
    // Shell already rendered, so the outgoing screen holds.
    expect(view.container.textContent).toBe('a');
    expect(lock().disabled).toBe(true);

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('b');
    expect(lock().disabled).toBe(false);
  });
});

describe('pending teardown', () => {
  it('will settle work left pending by an unmount', async () => {
    class Data extends State {
      value = 'a';
    }

    const data = Data.new();
    const gate = mockPromise<void>();
    let settled = false;

    const Screen = () => {
      const { value } = Data.get();
      if (value === 'b') throw gate;
      return <span>{value}</span>;
    };

    class Shell extends Component {
      render() {
        return (
          <Suspense fallback={<i>fallback</i>}>
            <Screen />
          </Suspense>
        );
      }
    }

    const view = render(
      <Provider for={data}>
        <Shell />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      pending(() => {
        data.value = 'b';
      }).then(() => {
        settled = true;
      });
      await Promise.resolve();
    });

    expect(settled).toBe(false);

    await act(async () => {
      view.unmount();
      await Promise.resolve();
    });

    expect(settled).toBe(true);
  });
});
