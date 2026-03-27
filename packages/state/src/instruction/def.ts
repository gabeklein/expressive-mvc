import { listener } from '../observable';
import { State, STORE, uid, apply } from '../state';

declare namespace def {
  /**
   * Property initializer, will run upon instance creation.
   * Optional returned callback will run when once upon first access.
   */
  type Factory<T = any, M extends State = any> = (
    this: M,
    key: Extract<State.Field<M>, string>,
    thisArg: M,
    state: State.Values<M>
  ) => def.Config<T> | (() => void) | void;

  interface Config<T = any> extends State.Apply<T> {
    destroy?: () => void;
  }
}

const APPLY = new Map<symbol, def.Factory>();

function def<T>(arg1: def.Factory<T>) {
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

    apply(self, key, desc, true);
  }

  return null;
});

export { def };
