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
      unmount: () => void;
      update: (next: (previous: number) => number) => void;
      output: T;
    }
  );

  current.update = Runtime.useState(() => {
    if (!current.mounted)
      current.unmount = callback((next) => {
        current.output = next;
        current.update?.((x) => x + 1);
      });

    return current.mounted++;
  })[1];

  Runtime.useEffect(() => () => {
    if (--current.mounted < 1) current.unmount();
  }, []);

  return current.output;
}