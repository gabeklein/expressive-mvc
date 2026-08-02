import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import './index';
import { revision, Runtime, useHook } from './runtime';

// useHook calls useRef, useState, useEffect once each per render. Stub Runtime
// with a hand-driven lifecycle so a subscription update can fire before vs.
// after commit, and watch whether the React setter actually runs.
function harness() {
  const ref = { current: undefined as any };
  let inited = false;
  let state = 0;
  let effect: () => (() => void) | void;
  let refresh: (next?: any) => void;
  let reset: () => void;
  const unmount = vi.fn();

  // Apply the updater like React would, so the `(x) => x + 1` path is exercised.
  const update = vi.fn((fn: (prev: number) => number) => void (state = fn(state)));

  Runtime.useRef = ((value: any) => {
    if (ref.current === undefined) ref.current = value;
    return ref;
  }) as typeof Runtime.useRef;

  Runtime.useState = ((value: any) => {
    if (!inited) {
      inited = true;
      if (typeof value === 'function') value(); // run initializer (subscribes)
    }
    return [state, update];
  }) as typeof Runtime.useState;

  Runtime.useEffect = ((fn: any) => void (effect = fn)) as typeof Runtime.useEffect;
  Runtime.useRevision = revision();

  let cleanup: (() => void) | void;

  return {
    update,
    unmount,
    render: () => useHook((r, x) => ((refresh = r), (reset = x), () => unmount)),
    commit: () => void (cleanup = effect()),
    unwind: () => cleanup && cleanup(),
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

  Runtime.useRevision = ((get: () => number) =>
    void (getRevision = get)) as typeof Runtime.useRevision;

  render();
  expect(getRevision()).toBe(0);

  reset();
  expect(getRevision()).toBe(1);

  render();
  expect(getRevision()).toBe(1);
});

it('will validate revisions through useSyncExternalStore', () => {
  const uSES = vi.fn((_subscribe: any, get: () => number) => get());
  const useRevision = revision(uSES)!;
  const getRevision = () => 5;

  useRevision(getRevision);

  expect(uSES).toHaveBeenCalledWith(expect.any(Function), getRevision, getRevision);

  const [subscribe] = uSES.mock.calls[0];
  expect(subscribe(() => {})()).toBeUndefined();
});

it('will not validate without useSyncExternalStore', () => {
  const getRevision = vi.fn();

  expect(revision()(getRevision)).toBeUndefined();
  expect(getRevision).not.toHaveBeenCalled();
});


