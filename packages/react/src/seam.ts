import { watch, unbind, Component } from '@expressive/mvc';
import { useHook } from './runtime';

/**
 * Make host-assigned own-properties land non-enumerable per instance, keeping
 * them out of observed state. The framework writes these on mount (React's
 * `updater`/`_reactInternals`, preact's mangled internals); intercept each via
 * the prototype so the value sits as a plain own property instead of tripping
 * state observation.
 */
export function intercept(proto: object, keys: string[]) {
  for (const key of keys)
    Object.defineProperty(proto, key, {
      set(value) {
        Object.defineProperty(this, key, { value, writable: true });
      }
    });
}

/**
 * Rewrite a capitalized prototype method into a subcomponent - a function
 * component which renders with the owner instance as `this` and re-renders
 * when the owner updates. Resolved and cached on the owner at first access.
 */
export function defineSubcomponent(proto: Component, key: string) {
  const { get, value } = Object.getOwnPropertyDescriptor(proto, key)!;

  if (!(get || typeof value == 'function')) return;

  Object.defineProperty(proto, key, {
    configurable: true,
    get(this: Component) {
      const owner = this.is;
      let render = unbind(get ? get.call(owner) : value);
      const Component = (props: unknown) =>
        render.call(
          useHook<Component>((set) => watch(owner, set)) || owner,
          props
        );

      Object.defineProperty(owner, key, {
        configurable: true,
        get: () => Component,
        set(fn: Function) {
          render = fn;
        }
      });

      return Component;
    }
  });
}
