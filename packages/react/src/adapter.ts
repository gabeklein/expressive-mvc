export const Pragma = {} as {
  useState<S>(initial: () => S): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => () => void, deps?: any[]): void;
  createElement(type: any, props?: any, ...children: any[]): any;
};
