import { State, get } from '@expressive/mvc';

import { Async, Input, input } from './Input';

type Field<T extends Form> = Exclude<keyof T, keyof Form>;

type Values<T extends Form> = {
  [K in Field<T>]: T[K];
};

const exclude = new Set([
  'checkpoint', 'invalid', 'for', 'inputs', 'nested', 'parent', 'form'
]);

declare namespace Form {
  export { Input, Values };
}

class Form extends State {
  constructor(...args: State.Args) {
    super(...args, () => {
      const source = this.for as Record<string, any> | undefined;

      if (source && typeof source == 'object')
        for (const key in this)
          if (!exclude.has(key)) this[key] = source[key];

      this.checkpoint = this.values();

      // Discovery: flat downstream collection, scoped to direct ownership.
      // `i.parent === this` filters out inputs owned by nested forms - the
      // boundary downstream collection itself lacks (see issue #197).
      this.get(Input, (i) => {
        if (i.parent !== this) return;

        this.inputs.add(i);
        i.get(null, () => {
          this.inputs.delete(i);
        });
      }, true);

      this.get(Form, (f) => {
        if (f === this || f.parent !== this) return;

        this.nested.add(f);
        f.get(null, () => {
          this.nested.delete(f);
        });
      }, true);
    });
  }

  checkpoint = {} as Values<this>;

  form = input(this);

  inputs = new Set<Input>();
  nested = new Set<Form>();

  /** Nearest enclosing Form (skips self), for nested-form ownership. */
  parent?: Form = get(Form, false);

  for?: unknown = undefined;

  changed() {
    const values = {} as Partial<Values<this>>;

    for (const key in this) {
      if (exclude.has(key)) continue;

      let value = (this as any)[key];

      if (value instanceof Form) {
        value = value.changed();
        if (!value) continue;
      }

      if (value !== (this.checkpoint as any)[key])
        (values as any)[key] = value;
    }

    if (Object.keys(values).length) return values;
  }

  values() {
    const values = {} as Values<this>;

    for (const key in this) {
      if (exclude.has(key)) continue;

      let value = (this as any)[key];

      if (value instanceof Form) value = value.values();

      (values as any)[key] = value;
    }

    return values;
  }

  reset() {
    Object.assign(this, this.checkpoint);
  }

  warn(i: Input) {
    i.warning = true;
    const off = i.set('value', () => {
      i.warning = undefined;
      off();
    });
  }

  accept(values: Values<this>, self: this): Async<boolean | void> {
    if (this.for && typeof this.for == 'object')
      Object.assign(this.for, this.changed());

    return true;
  }

  reject(invalid: Set<Input>): Async<boolean | void> {
    return false;
  }

  async ready() {
    const invalid = await this.invalid();
    return invalid
      ? (await this.reject(invalid)) !== false
      : (await this.accept(this.values(), this)) !== true;
  }

  async valid(i: Input): Promise<boolean> {
    try {
      let isValid = await i.valid(i);

      if (isValid === undefined) isValid = true;
      if (isValid) i.warning = undefined;

      return isValid;
    } catch (e) {
      this.warn(i);
      return false;
    }
  }

  async invalid() {
    const invalid = new Set<Input>();

    await Promise.all([
      ...[...this.inputs].map(async (i) => {
        if (!(await this.valid(i))) invalid.add(i);
      }),
      ...[...this.nested].map(async (form) => {
        const rejected = await form.invalid();
        if (rejected) for (const i of rejected) invalid.add(i);
      })
    ]);

    if (invalid.size) return invalid;
  }
}

export { Form };
