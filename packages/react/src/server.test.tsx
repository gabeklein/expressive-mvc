import { afterEach, describe, expect, it } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { Context, State } from '.';
import { mockWarn } from '../test.setup';

describe('server flag', () => {
  afterEach(() => {
    Context.server = false;
  });

  it('will be off when a DOM is present', () => {
    expect(Context.server).toBe(false);
  });

  it('will warn for a context-less non-global during server render', () => {
    const warn = mockWarn();
    Context.server = true;

    class Store extends State {
      value = 1;
    }

    const state = Store.new();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('activated during server render with no context')
    );

    state.set(null);
  });

  it('will not warn for a use() instance during server render', () => {
    const warn = mockWarn();
    Context.server = true;

    class Test extends State {
      value = 'foo';
    }

    renderHook(() => Test.use());

    expect(warn).not.toHaveBeenCalled();
  });
});
