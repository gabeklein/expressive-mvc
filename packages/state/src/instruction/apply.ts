import { listener } from '../observable';
import { State, STORE, uid, apply as config } from '../state';

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Apply<T = any, M extends State = any> = (
  this: M,
  key: Extract<State.Field<M>, string>,
  thisArg: M,
  state: State.Values<M>
) => Apply.Config<T> | (() => void) | void;

declare namespace Apply {
  interface Config<T = any> extends State.Apply<T> {
    destroy?: () => void;
  }
}

const APPLY = new Map<symbol, Apply>();

function apply<T>(arg1: Apply<T>) {
  const token = Symbol('instruction-' + uid());
  APPLY.set(token, arg1);
  return token as T extends void ? unknown : T;
}

State.on((_key, self) => {
  const store = STORE.get(self)!;

  for (const key in self) {
    const property = Object.getOwnPropertyDescriptor(self, key)!;
    const instruction = APPLY.get(property.value);

    if (!instruction) continue;

    APPLY.delete(property.value);
    delete (self as any)[key];

    const output = instruction.call(self, key, self, store);

    if (!output) continue;

    const desc = typeof output == 'function' ? { destroy: output } : output;

    if (desc.destroy) listener(self, desc.destroy, null);

    config(self, key, desc, true);
  }

  return null;
});

export { apply, Apply };
