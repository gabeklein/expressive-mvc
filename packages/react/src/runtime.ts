export const Pragma = {} as {
  createElement(type: any, props?: any, ...children: any[]): any;
  useState<S>(initial: S | (() => S)): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => (() => void) | void, deps?: any[]): void;
  useRef<T>(initial: T): { current: T };
};

export function useFactory<T extends Function>(factory: () => T) {
  const ref = Pragma.useRef<T | null>(null);
  return ref.current || (ref.current = factory());
}

/**
 * useState factory which tolerates react StrictMode double-invoking.
 */
export function useStrict<T = void>(
  callback: (refresh: (next: T) => void) => () => void
) {
  const { current } = Pragma.useRef(
    { mounted: 0 } as {
      output: T;
      mounted: number;
      unmount: () => void;
      update: (next: (previous: number) => number) => void;
    }
  );

  current.update = Pragma.useState(() => {
    if (!current.mounted)
      current.unmount = callback((next) => {
        current.output = next;
        current.update?.((x) => x + 1);
      });

    return current.mounted++;
  })[1];

  Pragma.useEffect(() => () => {
    if (--current.mounted < 1) current.unmount();
  }, []);

  return current.output;
}
