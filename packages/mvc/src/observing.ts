import type { Observer } from './observable';

interface Observing {
  callback: Observer.Callback;
  watching: Set<Observer.Signal>;
  required?: boolean;
  release: (() => void)[];
}

const Observing: unique symbol = Symbol('Observing');

interface Observed { [Observing]?: Observing }

function strict<T>(value: T): T {
  const active = (value as Observed | null | undefined)?.[Observing];

  return active
    ? Object.create(value as object, {
        [Observing]: { value: Object.create(active, { required: { value: true } }) }
      })
    : value;
}

export { Observing, strict };
export type { Observed };
