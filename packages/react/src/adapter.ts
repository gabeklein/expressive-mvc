export const Pragma = {} as {
  useState<S>(initial: () => S): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => () => void, deps?: any[]): void;
  createElement(type: any, props?: any, ...children: any[]): any;
};

export function useFactory<A, R>(
  arg: A,
  fn: (refresh: () => void) => (arg: A) => R
): R {
  const state = Pragma.useState(() => {
    const refresh = () => state[1]((x) => x.bind(null));
    const factory = fn(refresh);
    return (arg: A) => factory(arg);
  });

  return state[0](arg);
}
