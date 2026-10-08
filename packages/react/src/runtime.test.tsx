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

it('will defer cleanup following an uncommitted render', async () => {
  const { render, commit, unwind, unmount } = harness();

  render();
  commit();
  render();
  unwind();

  expect(unmount).not.toHaveBeenCalled();

  await Promise.resolve();

  expect(unmount).toHaveBeenCalledTimes(1);
});

it('will not cleanup if effects re-run after render', async () => {
  const { render, commit, unwind, unmount } = harness();

  render();
  commit();
  render();
  unwind();
  commit();

  await Promise.resolve();

  expect(unmount).not.toHaveBeenCalled();
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
    let settled = false;

    gate.then(() => (ready = true));

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

    class Shell extends Component {
      pending = false;

      go(to: string) {
        this.pending = true;
        pending(() => (data.value = to)).then(() => (this.pending = false));
      }
    }

    return {
      gate,
      data,
      Content,
      Shell,
      settled: () => settled,
      async mount(children: ReactNode) {
        const view = render(<Provider for={data}>{children}</Provider>);
        await act(async () => {});
        return view;
      },
      transition: (go: () => void = () => void pending(() => (data.value = 'b')).then(() => (settled = true))) =>
        act(async () => {
          go();
          await Promise.resolve();
        }),
      release: () =>
        act(async () => {
          gate.resolve();
          await gate;
        })
    };
  }

  it('will hold current content until the replacement is absorbed', async () => {
    const { Content, mount, transition, release, settled } = scenario();
    const view = await mount(<Content />);

    await transition();

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('a');
    expect(settled()).toBe(false);

    await release();

    expect(view.container.textContent).toBe('b');
    expect(settled()).toBe(true);
  });

  it('will release a claim when its subscriber is hidden mid-flight', async () => {
    const { gate, Content, mount, transition, settled } = scenario();
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

    await mount(<App />);
    await transition();

    expect(settled()).toBe(false);

    await act(async () => hide());

    expect(settled()).toBe(true);

    gate.resolve();
  });

  it('will not claim for a subscriber which is already hidden', async () => {
    const { Content, mount, transition, settled } = scenario();

    await mount(
      <Activity mode="hidden">
        <Content />
      </Activity>
    );
    await transition();

    expect(settled()).toBe(true);
  });

  it('will hold every reader while one of them suspends', async () => {
    const { Content, mount, transition, release } = scenario();
    const Fast = () => <b>{Data.get().value}</b>;

    const view = await mount(
      <>
        <Fast />
        <Content />
      </>
    );

    await transition();

    // React entangles a transition - it will not commit the reader which is
    // ready while its sibling is suspended.
    expect(view.container.textContent).toBe('aa');

    await release();

    expect(view.container.textContent).toBe('bb');
  });

  it('will wait on every reader, not the first', async () => {
    const { data, Content, mount, transition, release, settled } = scenario();
    const seen: string[] = [];

    data.get(({ value }) => void seen.push(value));

    await mount(<Content />);
    await transition();

    expect(seen).toEqual(['a', 'b']);
    expect(settled()).toBe(false);

    await release();

    expect(settled()).toBe(true);
  });

  it('will track pending from a sibling', async () => {
    const { Content, Shell, mount, transition, release } = scenario();
    let shell!: InstanceType<typeof Shell>;

    const Status = () => <b>{Shell.get().pending ? 'busy' : 'idle'}</b>;

    const view = await mount(
      <Shell is={(i) => (shell = i)}>
        <Status />
        <Content />
      </Shell>
    );

    expect(view.container.textContent).toBe('idlea');

    await transition(() => shell.go('b'));

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('busya');

    await release();

    expect(view.container.textContent).toBe('idleb');
  });

  it('will disable outgoing content without collapsing it', async () => {
    const { Content, Shell, mount, transition, release } = scenario();
    let shell!: InstanceType<typeof Shell>;

    const Lock = ({ children }: { children: ReactNode }) => (
      <fieldset disabled={Shell.get().pending}>{children}</fieldset>
    );

    const view = await mount(
      <Shell is={(i) => (shell = i)}>
        <Lock>
          <Content />
        </Lock>
      </Shell>
    );

    const lock = () => view.container.querySelector('fieldset')!;

    expect(lock().disabled).toBe(false);

    await transition(() => shell.go('b'));

    // The wrapper re-renders urgently and locks down; its child is the element
    // Shell already rendered, so the outgoing screen holds.
    expect(view.container.textContent).toBe('a');
    expect(lock().disabled).toBe(true);

    await release();

    expect(view.container.textContent).toBe('b');
    expect(lock().disabled).toBe(false);
  });

  it('will settle work left pending by an unmount', async () => {
    const { Content, Shell, mount, transition, settled } = scenario();
    const view = await mount(
      <Shell>
        <Content />
      </Shell>
    );

    await transition();

    expect(settled()).toBe(false);

    await act(async () => {
      view.unmount();
      await Promise.resolve();
    });

    expect(settled()).toBe(true);
  });
});
