import { vi, describe, it, expect } from 'vitest';
import { observer, watch } from './observable';
import { strict } from './observing';
import { Model } from './state';

describe('strict', () => {
  class Test extends Model {
    value = 1;
    maybe?: string = undefined;
  }

  it('will pass through a non-Model', () => {
    const object = {};

    expect(strict(object)).toBe(object);
    expect(strict('value')).toBe('value');
    expect(strict(null)).toBeNull();
    expect(strict(undefined)).toBeUndefined();
  });

  it('will pass through an untracked instance', () => {
    const test = Test.new();

    expect(strict(test)).toBe(test);
  });

  it('will throw on an undefined value', () => {
    const test = Test.new();

    watch(test, (proxy) => {
      const view = strict(proxy);

      expect(view).not.toBe(proxy);
      expect(view.is).toBe(test);
      expect(view.value).toBe(1);
      expect(proxy.maybe).toBeUndefined();
      expect(() => view.maybe).toThrow(/\.maybe is required in this context\./);
    });
  });

  it('will share subscription with its proxy', async () => {
    const test = Test.new();
    const effect = vi.fn();

    watch(test, (proxy) => {
      effect(strict(proxy).value, proxy.value);
    });

    test.value = 2;
    await expect(test).toHaveUpdated();

    expect(effect).toBeCalledTimes(2);
    expect(effect).toHaveBeenLastCalledWith(2, 2);
  });

  it('will not add a listener', () => {
    const test = Test.new();
    const { listeners } = observer(test)!;

    watch(test, (proxy) => {
      const before = listeners.size;

      void strict(proxy).value;
      expect(listeners.size).toBe(before);
    });
  });
});
