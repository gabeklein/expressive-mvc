import { State } from '@expressive/mvc';
import { Signal, createSignal } from 'solid-js';

export const SIGNALS = new WeakMap<State, Map<string, Signal<unknown>>>();

declare module '@expressive/mvc' {
  namespace State {
    /**
     * Replaces all values which are not functions into signal getters,
     * usable within a SolidJS root, such as a component.
     */
    type Reactive<T extends State> = {
      [P in keyof T]: P extends keyof State
        ? T[P]
        : T[P] extends (...args: unknown[]) => unknown
          ? T[P]
          : () => T[P];
    };
  }
}

export function signalProxy<T extends State>(instance: T) {
  let signals = SIGNALS.get(instance);

  if (!signals) SIGNALS.set(instance, (signals = new Map()));

  instance.set((key) => {
    if (typeof key === 'string') {
      const signal = signals.get(key);
      if (signal) {
        const value = (instance as any)[key];
        signal[1](value);
      }
    }
  });

  return new Proxy(instance, {
    get(target, prop: string | symbol) {
      const value = (target as any)[prop];

      if (
        typeof value === 'function' ||
        typeof prop === 'symbol' ||
        prop === 'is'
      ) {
        return value;
      }

      let signal = signals!.get(prop as string);

      if (!signal) {
        signal = createSignal(value);
        signals!.set(prop as string, signal);
      }

      return signal[0];
    }
  }) as State.Reactive<T>;
}
