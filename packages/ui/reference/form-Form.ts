import { Model, has, set } from '@expressive/react';

import { Input, input } from './Input';

type Field<T extends Form> = Exclude<keyof T, keyof Form>;

type Values<T extends Form> = {
  [K in Field<T>]: T[K];
};

const exclude = new Set(['checkpoint', 'invalid', 'for']);

declare namespace Form {
  export { Input, Values };
}

class Form extends Model {
  constructor(...args: Model.Args) {
    super(...args, () => {
      const source = this.for as Record<string, any> | undefined;

      if (!source || typeof source != 'object') return;

      for (const key in this) if (!exclude.has(key)) this[key] = source[key];
    });
  }

  checkpoint = set(() => this.values, true);

  form = input(this);

  inputs = has(Input);
  nested = has(Form);

  for?: unknown = undefined;

  get changed() {
    const values = {} as Partial<Values<this>>;

    for (const key in this) {
      if (exclude.has(key)) continue;

      let value = (this as any)[key];

      if (value instanceof Form) {
        value = value.changed;
        if (!value) continue;
      }

      if (value !== (this.checkpoint as any)[key]) {
        (values as any)[key] = value;
      }
    }

    if (Object.keys(values).length) return values;
  }

  get values() {
    const values = {} as Values<this>;

    for (const key in this) {
      if (exclude.has(key)) continue;

      let value = (this as any)[key];

      if (value instanceof Form) {
        value = value.values;
      }

      (values as any)[key] = value;
    }

    return values;
  }

  reset() {
    Object.assign(this, this.checkpoint);
  }

  warn(i: Input, error: Error) {
    i.warning = true;
    i.get('value', () => {
      i.warning = undefined;
      return null;
    });
  }

  accept(values: Values<this>, self: this): Async<boolean | void> {
    if (this.for && typeof this.for == 'object') {
      Object.assign(this.for, this.changed);
    }

    return true;
  }

  reject(invalid: Set<Input>): Async<boolean | void> {
    return false;
  }

  async ready() {
    const invalid = await this.invalid();
    return invalid
      ? (await this.reject(invalid)) !== false
      : (await this.accept(this.values, this)) !== true;
  }

  async valid(i: Input): Promise<boolean> {
    const { valid } = i;

    try {
      let isValid = await valid(i);

      if (isValid === undefined) isValid = true;
      if (isValid) i.warning = undefined;

      return isValid;
    } catch (e) {
      this.warn(i, e as Error);
      return false;
    }
  }

  async invalid() {
    const invalid = new Set<Input>();

    await Promise.all([
      ...this.inputs.map(async (i) => {
        const valid = await this.valid(i);
        if (!valid) invalid.add(i);
      }),
      ...this.nested.map(async (form) => {
        const rejected = await form.invalid();

        if (rejected) {
          for (const i of rejected) invalid.add(i);
        }
      })
    ]);

    if (invalid.size) return invalid;
  }
}

export { Form };
