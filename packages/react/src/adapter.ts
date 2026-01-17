namespace Pragma {}

const Pragma = {} as {
  useState<S>(initial: () => S): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => () => void, deps?: any[]): void;
  createElement(type: any, props?: any, ...children: any[]): any;
};

export { Pragma };

import './state.as';
import './state.use';
import './state.get';
