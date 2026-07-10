import { event, watch, observer } from '@expressive/mvc/observable';
import type { Component } from '@expressive/mvc';
import type { Context } from './context';

export const Runtime = {} as {
  /** Host own-property keys to trap out of observed state; assigned by each adapter. */
  ignore: string[];
  createElement(type: any, props?: any, ...children: any[]): any;
  createContext<T>(value: T): any;
  useContext(context: any): any;
  useState<S>(initial: S | (() => S)): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => (() => void) | void, deps?: any[]): void;
  useRef<T>(initial: T): { current: T };
  /** Per-render-attempt lifecycle, set by each adapter (React stacks attempts; others no-op). */
  dedupe(from: Component, context: Context): { commit(): void; remove(): void };
  /** Host error-boundary component, wrapping a Component whose `catch` is set. */
  ErrorBoundary: unknown;
  Suspense: any;
};

export function useFactory<T extends Function>(factory: () => T) {
  const ref = Runtime.useRef<T | null>(null);
  return ref.current || (ref.current = factory());
}

/**
 * React Compiler dev guard. A subscribed component whose watched value changed
 * must re-render; if the hook body is not re-invoked after an update we
 * requested, the compiler memoized the hook call and skipped its internal
 * hooks. `seen` counts hook-body runs; `check` (called after requesting an
 * update) verifies another run followed on the next macrotask. Since whether a
 * component is compiled is fixed for its lifetime, one check settles it.
 */
export function guard(subject: object) {
  let renders = 0;
  let scheduled = false;
  let live = true;

  return {
    seen: () => void renders++,
    stop: () => void (live = false),
    check() {
      if (scheduled || !live) return;
      scheduled = true;
      const at = renders;
      setTimeout(() => {
        if (live && renders === at)
          console.warn(
            `A component subscribed to ${subject} did not re-render after an ` +
            `update - React Compiler likely memoized the hook. Add the ` +
            `"use no memo" directive to that component, or express it as a ` +
            `Component class (which needs no opt-out).`
          );
      });
    }
  };
}

export function useReady<T>(callback: () => void) {
  return Runtime.useEffect(() => void callback(), []);
}

/**
 * Mount-effect with a refreshable return value, safe under React StrictMode.
 *
 * @param callback Setup handler; receives a setter, must return a cleanup.
 * @returns Latest value published via the setter (`undefined` until set).
 */
export function useHook<T = void>(
  callback: (refresh: (next: T) => void) => () => void
) {
  const { current } = Runtime.useRef(
    { rendered: 0 } as {
      rendered: number;
      mounted?: boolean;
      pending?: boolean;
      unmount: () => void;
      update?: (next: (previous: number) => number) => void;
      output: T;
    }
  );

  current.update = Runtime.useState(() => {
    if (!current.rendered)
      current.unmount = callback((next) => {
        current.output = next;
        if (current.mounted) current.update?.((x) => x + 1);
        else if (current.update) current.pending = true;
      });

    return current.rendered++;
  })[1];

  Runtime.useEffect(() => {
    current.mounted = true;
    if (current.pending) {
      current.pending = false;
      current.update!((x) => x + 1);
    }
    return () => {
      if (--current.rendered < 1) current.unmount();
    }
  }, []);

  return current.output;
}

/** Subscribe to an existing observable instance within a component. */
export function use<T extends object>(subject: T) {
  const { current } = Runtime.useRef<{
    proxy: T;
    source?: T;
    mounted: number;
    unwatch?: () => void;
    guard?: ReturnType<typeof guard>;
  }>({ mounted: 0, proxy: subject });

  current.guard?.seen();

  const update = Runtime.useState(() => current.mounted++)[1];

  if (current.source !== subject) {
    const status = observer(subject);

    if (status === undefined)
      throw new Error('Provided object is not observable.');

    current.unwatch?.();
    current.source = subject;

    if (status === null) {
      current.unwatch = undefined;
      current.proxy = subject;
    } else {
      if (!status.ready) event(subject);

      let init = true;
      const watchdog = (current.guard = guard(subject));

      current.unwatch = watch(subject, (next, changed) => {
        current.proxy = next;
        if (changed.length && !init) {
          update((x) => x + 1);
          watchdog.check();
        }
      });

      init = false;
    }
  }

  Runtime.useEffect(() => () => {
    if (--current.mounted < 1) {
      current.guard?.stop();
      current.unwatch?.();
    }
  }, []);

  return current.proxy;
}
