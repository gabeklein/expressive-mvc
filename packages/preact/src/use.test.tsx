/** @jsxImportSource preact */
import { act, renderHook, waitFor } from '@testing-library/preact';

import { State, use as useObservable } from '.';
import { describe, expect, it, mock, spyOn } from '../test';

describe('use', () => {
  class Test extends State {
    foo = 'foo';
    bar = 'bar';
  }

  it('will subscribe to observable instance', async () => {
    const test = Test.new();
    const didRender = mock();
    const hook = renderHook(() => {
      didRender();
      return useObservable(test).foo;
    });

    expect(hook.result.current).toBe('foo');
    expect(didRender).toBeCalledTimes(1);

    await act(async () => {
      test.set({ foo: 'next' });
    });

    await waitFor(() => {
      expect(hook.result.current).toBe('next');
    });
  });

  it('will not destroy subject on unmount', async () => {
    const test = Test.new();
    const hook = renderHook(() => useObservable(test).foo);

    await waitFor(() => {
      expect(hook.result.current).toBe('foo');
    });

    hook.unmount();

    expect(test.get(null)).toBe(false);
    expect(() => test.set({ foo: 'next' })).not.toThrow();
  });
});
