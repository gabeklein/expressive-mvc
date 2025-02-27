import { Model, createProxy } from '@expressive/mvc';
import { Signal, createSignal } from "solid-js";

export const SIGNALS = new WeakMap<Model, Map<string, Signal<unknown>>>();

declare module '@expressive/mvc' {
  namespace Model {
    /**
     * Replaces all values which are not functions into signal getters,
     * usable within a SolidJS root, such as a component.
     */
    type Reactive<T extends Model> = {
      [P in keyof T]: P extends keyof Model ? T[P]
        : T[P] extends (...args: unknown[]) => unknown ? T[P]
        : () => T[P];
    }
  }
}

export function signalProxy<T extends Model>(instance: T) {
  let signals = SIGNALS.get(instance);

  if (!signals)
    SIGNALS.set(instance, signals = new Map);

  const proxy = createProxy(instance, (_, key, value) => {
    if (typeof value !== 'function') {
      let signal = signals.get(key as string);

      if (!signal)
        signals.set(key as string, signal = createSignal(value));

      return signal[0];
    }

    return value;
  });

  instance.set((key) => {
    if (typeof key === 'string') {
      const signal = signals.get(key);

      if (signal)
        signal[1](instance.get(key));
    }
  });

  return proxy as Model.Reactive<T>;
}
