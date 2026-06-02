export const Runtime = {} as {
  createElement(type: any, props?: any, ...children: any[]): any;
  useState<S>(initial: S | (() => S)): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => (() => void) | void, deps?: any[]): void;
  useRef<T>(initial: T): { current: T };
};

export function useFactory<T extends Function>(factory: () => T) {
  const ref = Runtime.useRef<T | null>(null);
  return ref.current || (ref.current = factory());
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
    { mounted: 0 } as {
      mounted: number;
      committed: boolean;
      pending: boolean;
      unmount: () => void;
      update?: (next: (previous: number) => number) => void;
      output: T;
    }
  );

  current.update = Runtime.useState(() => {
    if (!current.mounted)
      current.unmount = callback((next) => {
        current.output = next;
        // A change arriving before this fiber has committed (e.g. a sibling
        // mutating shared state during render) can't setState yet - defer the
        // refresh to the commit effect below. `update` is undefined during this
        // initializer, so the initial subscribe is ignored regardless.
        if (current.committed) current.update?.((x) => x + 1);
        else if (current.update) current.pending = true;
      });

    return current.mounted++;
  })[1];

  Runtime.useEffect(() => {
    current.committed = true;
    if (current.pending) {
      current.pending = false;
      current.update!((x) => x + 1);
    }

    return () => {
      current.committed = false;
      if (--current.mounted < 1) current.unmount();
    };
  }, []);

  return current.output;
}