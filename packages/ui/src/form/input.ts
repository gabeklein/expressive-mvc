import { Model, get, ref } from '@expressive/mvc';

import { Form } from './form';

export type Ref<T extends Model = any> = (input?: Input) => readonly [T, keyof T];

export type Async<T> = T | Promise<T>;

/**
 * Build a custom ref proxy keyed per field. `form.email` returns a binder that,
 * when attached to an Input, wires two-way reactivity between form and input.
 */
export function input<T extends Model>(from: T) {
  function bind(input: Input, key: keyof T) {
    input.name = key as string;
    from.get((current) => {
      input.value = current[key];
    });
    input.get((current) => {
      from[key] = current.value;
    });
  }

  function forEach(key: keyof T): Ref<T> {
    return (input?: Input) => {
      if (input) bind(input, key);
      return [from, key];
    };
  }

  return ref(from, forEach);
}

export class Input<T = any> extends Model {
  name = '';

  disabled = false;
  optional = false;
  default?: T = undefined;
  value: T | undefined = this.default;
  warning?: string | boolean = undefined;

  /** Nearest owning Form via the singular (shadowing) lookup path. */
  parent?: Form = get(Form, false);

  valid(self: this): Async<boolean | void> {
    const { value, optional } = this;

    if ((value == undefined || value === '') && !optional)
      throw new Error('Required');
  }
}
