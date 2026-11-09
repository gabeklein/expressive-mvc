import { listener } from '../observable';
import { PENDING, Model, uid } from '../model';
import { apply, store } from '../store';

declare namespace def {
  /**
   * Runs on activation with `(key, instance, values)` - `this` is the instance.
   *
   * `values` is the live store of managed values. Return nothing for a side effect only, a function
   * to run on destroy, or a {@link def.Config} to define the property.
   */
  type Factory<T = any, M extends Model = any> = (
    this: M,
    key: Extract<Model.Field<M>, string>,
    thisArg: M,
    state: Model.Values<M>
  ) => def.Config<T> | (() => void) | void;

  /** Property definition - `value`, `get`, `set` and `enumerable`, plus a `destroy` hook. */
  interface Config<T = any> extends Model.Apply<T> {
    /** Runs when the instance is destroyed. */
    destroy?: () => void;
  }
}

const APPLY = new Map<symbol, [def.Factory, Model[]] | null>();
const RESET = () => APPLY.clear();

/**
 * Custom instruction - define a managed property from a factory run when the instance activates.
 *
 * Call only in a field initializer of a Model under construction - otherwise throws. Returns a
 * placeholder symbol, replaced on activation. One instruction per field - reusing it on another
 * Model throws, as does a `_` key. The returned config defines the property:
 * - `value` - initial value, set without an event. With neither `value` nor `get`, reads suspend until assigned.
 * - `get` - a function computes each read, given the subscriber or the instance; `true` suspends
 *   while undefined; `false` reads `undefined`. Read from the config on every access.
 * - `set` - `false` makes it read-only. A function gets `(next, previous)` - throw `false` to
 *   reject, `true` to skip the event; a returned value replaces `next`.
 * - `enumerable` - default `true`.
 *
 * @example
 * ticks = def<number>((key, self) => {
 *   const timer = setInterval(() => self.ticks++, 1000);
 *   return { value: 0, destroy: () => clearInterval(timer) };
 * });
 */
function def<T>(arg1: def.Factory<T>) {
  if (!PENDING.size || (PENDING.size == 1 && PENDING.has(RESET)))
    throw new Error(
      'Instruction created with no Model under construction.'
    );

  PENDING.add(RESET);

  const token = Symbol('field-' + uid());

  APPLY.set(token, [arg1, [...PENDING].filter((x) => x instanceof Model) as Model[]]);

  return token as [T] extends [void] ? unknown : T;
}

Model.on({
  setup(self) {
    const data = store(self);

    for (const key in self) {
      const property: PropertyDescriptor = Object.getOwnPropertyDescriptor(self, key) || {};
      const entry = APPLY.get(property.value);

      if (entry === null)
        throw new Error(
          `${self}.${key} has an instruction applied to another Model.`
        );

      if (!entry) continue;

      if (key[0] == '_')
        throw new Error(`${self}.${key} is unmanaged - instructions cannot apply to _ keys.`);

      const [instruction, pending] = entry;

      APPLY.set(property.value, null);
      discard(self, pending);
      delete (self as any)[key];

      const output = instruction.call(self, key, self, data);

      if (!output) continue;

      const desc = typeof output == 'function' ? { destroy: output } : output;

      if (desc.destroy) listener(self, desc.destroy, null);

      apply(self, key, desc, true);
    }
  }
});

/**
 * Drop pending Models constructed after `self` and before the instruction -
 * products of its own initializers, discarded when this token replaced them.
 */
function discard(self: Model, pending: Model[]) {
  let seen = false;

  for (const item of pending)
    if (!seen) seen = item === self;
    else PENDING.delete(item);
}

export { def };
