import { afterEach, describe, expect, it } from 'bun:test';
import { act, renderHook } from '@testing-library/react';
import { Context, State } from '.';
import { mockWarn } from '../test.setup';

describe('sealing', () => {
  afterEach(() => {
    Context.sealing = false;
  });

  it('will be off when a DOM is present', () => {
    expect(Context.sealing).toBe(false);
  });

  it('will seal a global root instance while sealing', () => {
    mockWarn();
    Context.sealing = true;

    class Store extends State {
      static global = true;
      value = 1;
    }

    const state = Store.new();

    state.value = 2;

    expect(state.value).toBe(1);
  });

  it('will not seal a context-less non-global while sealing', () => {
    const warn = mockWarn();
    Context.sealing = true;

    class Store extends State {
      value = 1;
    }

    const state = Store.new();

    state.value = 2;

    expect(state.value).toBe(2);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('activated during server render with no context')
    );
  });

  it('will not seal a use() instance while sealing', async () => {
    Context.sealing = true;

    class Test extends State {
      value = 'foo';
    }

    const { result } = renderHook(() => Test.use());

    await act(async () => {
      result.current.value = 'bar';
    });

    expect(result.current.value).toBe('bar');
  });
});
