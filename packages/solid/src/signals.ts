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

  // Set up listener to update signals when state changes
  instance.set((key) => {
    if (typeof key === 'string') {
      const signal = signals.get(key);
      if (signal) {
        // Get the current value from the instance and update the signal
        const value = (instance as any)[key];
        signal[1](value);
      }
    }
  });

  // Create a Proxy to transform property access into signal getters
  return new Proxy(instance, {
    get(target, prop: string | symbol) {
      // Get the current value from the instance
      const value = (target as any)[prop];

      // Methods, symbols, and special properties pass through as-is
      if (
        typeof value === 'function' ||
        typeof prop === 'symbol' ||
        prop === 'is'
      ) {
        return value;
      }

      // For data properties, create/get a signal
      let signal = signals!.get(prop as string);

      if (!signal) {
        signal = createSignal(value);
        signals!.set(prop as string, signal);
      }

      // Return the signal getter (a function that returns the current value)
      return signal[0];
    }
  }) as State.Reactive<T>;
}
