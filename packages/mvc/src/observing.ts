import type { Observer } from './observable';

interface Observing {
  callback: Observer.Callback;
  watching: Set<Observer.Signal>;
  required?: boolean;
  release: (() => void)[];
}

const Observing: unique symbol = Symbol('Observing');

interface Observed { [Observing]?: Observing }

export { Observing };
export type { Observed };
