import { listener } from '../observable';
import { PENDING, State, STORE, uid, apply } from '../state';

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

const APPLY = new Map<symbol, def.Factory | null>();
const RESET = () => APPLY.clear();

function def<T>(arg1: def.Factory<T>) {
  if (!PENDING.size || (PENDING.size == 1 && PENDING.has(RESET)))
    throw new Error(
      'Instruction created with no State under construction.'
    );

  PENDING.add(RESET);

  const token = Symbol('field-' + uid());

  APPLY.set(token, arg1);

  return token as T extends void ? unknown : T;
}

State.on((self) => {
  const store = STORE.get(self)!;

  for (const key in self) {
    const property: PropertyDescriptor = Object.getOwnPropertyDescriptor(self, key) || {};
    const instruction = APPLY.get(property.value);

    if (instruction === null)
      throw new Error(
        `${self}.${key} has an instruction applied to another State.`
      );

    if (!instruction) continue;

    APPLY.set(property.value, null);
    delete (self as any)[key];

    const output = instruction.call(self, key, self, store);

    if (!output) continue;

    const desc = typeof output == 'function' ? { destroy: output } : output;

    if (desc.destroy) listener(self, desc.destroy, null);

    apply(self, key, desc, true);
  }
});

export { def };
