import { afterEach, describe, expect, it } from 'bun:test';
import { mockWarn } from '../test.setup';
import { Context } from './context';
import { seal, State } from './state';

describe('seal', () => {
  class Counter extends State {
    count = 3;

    get double() {
      return this.count * 2;
    }
  }

  it('will ignore value writes but stay readable', () => {
    const state = Counter.new();

    seal(state);
    state.count = 10;

    expect(state.count).toBe(3);
  });

  it('will not dispatch an update when sealed', async () => {
    const state = Counter.new();

    seal(state);
    state.count = 10;

    await expect(state).not.toHaveUpdated();
  });

  it('will still compute getters (silent writes pass)', () => {
    const state = Counter.new();

    seal(state);

    expect(state.double).toBe(6);
  });

  it('will not destroy the state', () => {
    const state = Counter.new();

    seal(state);

    expect(state.get(null)).toBe(false);
  });

  it('will be idempotent', () => {
    const state = Counter.new();

    seal(state);
    seal(state);
    state.count = 10;

    expect(state.count).toBe(3);
  });

  it('will warn once per key', () => {
    const warn = mockWarn();
    const state = Counter.new();

    seal(state);

    state.count = 10;
    state.count = 20;

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/read-only during server render/);
  });
});

describe('Context.sealing', () => {
  afterEach(() => {
    Context.sealing = false;
  });

  it('will seal states registered to root', () => {
    class Store extends State {
      static global = true;
      value = 1;
    }

    Context.sealing = true;

    const state = Store.new();

    state.value = 2;

    expect(state.value).toBe(1);
  });

  it('will not seal a context-less non-global', () => {
    mockWarn();

    class Store extends State {
      value = 1;
    }

    Context.sealing = true;

    const state = Store.new();

    state.value = 2;

    expect(state.value).toBe(2);
    expect(Context.root.get(Store, false)).toBeUndefined();
  });

  it('will warn for a context-less non-global while sealing', () => {
    const warn = mockWarn();

    class Store extends State {}

    Context.sealing = true;

    Store.new();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('activated during server render with no context')
    );
  });

  it('will not seal states outside the root', () => {
    class Store extends State {
      value = 1;
    }

    Context.sealing = true;

    const context = new Context(Store);
    const state = context.get(Store);

    state.value = 2;

    expect(state.value).toBe(2);
  });

  it('will not seal when disabled', () => {
    class Store extends State {
      value = 1;
    }

    const state = Store.new();

    state.value = 2;

    expect(state.value).toBe(2);
  });
});
