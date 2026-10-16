import { Context } from '@expressive/mvc';
import { describe, expect, it, vi } from 'vitest';

import { Form } from './form';
import { Input } from './input';

/**
 * Mounts a form the way a render tree would: the form is a provider with its own
 * context, and field components (Inputs) mount in a child context beneath it. A
 * nested form is its own provider, mounted in the parent form's subtree - never
 * a plain field (that would land it in the parent's own context).
 */
function provide<T extends Form>(form: T, within?: Context) {
  const ctx = (within || new Context()).push();
  ctx.set(form);
  return {
    form,
    inputs(map: Record<string, Input>) {
      ctx.push().set(map);
      return this;
    },
    nest<N extends Form>(child: N) {
      return provide(child, ctx);
    }
  };
}

describe('discovery', () => {
  it('will collect inputs mounted downstream', async () => {
    const { form } = provide(new Form()).inputs({ a: new Input(), b: new Input() });
    await form.set();

    expect(form.inputs.size).toBe(2);
  });

  it('will not collect inputs owned by a nested form', async () => {
    const outer = provide(new Form()).inputs({ a: new Input() });
    const inner = outer.nest(new Form()).inputs({ b: new Input() });
    await outer.form.set();

    expect(outer.form.inputs.size).toBe(1);
    expect(outer.form.nested.has(inner.form)).toBe(true);
    expect(inner.form.inputs.size).toBe(1);
  });

  it('will only own directly nested forms', async () => {
    const outer = provide(new Form());
    const middle = outer.nest(new Form());
    const inner = middle.nest(new Form());
    await outer.form.set();

    expect([...outer.form.nested]).toEqual([middle.form]);
    expect([...middle.form.nested]).toEqual([inner.form]);
  });
});

describe('validation protocol', () => {
  it('will reject when a required input is empty', async () => {
    const required = new Input();
    const { form } = provide(new Form()).inputs({ required });
    await form.set();

    const invalid = await form.invalid();
    expect(invalid?.has(required)).toBe(true);
    expect(required.warning).toBe(true);
  });

  it('will pass when optional or filled', async () => {
    const filled = new Input();
    filled.value = 'x';
    const optional = new Input();
    optional.optional = true;

    const { form } = provide(new Form()).inputs({ filled, optional });
    await form.set();

    expect(await form.invalid()).toBeUndefined();
  });

  it('will recurse into nested forms', async () => {
    const outer = provide(new Form()).inputs({});
    const innerRequired = new Input();
    outer.nest(new Form()).inputs({ innerRequired });
    outer.nest(new Form());
    await outer.form.set();

    const invalid = await outer.form.invalid();
    expect(invalid?.has(innerRequired)).toBe(true);
  });
});

describe('dirty tracking', () => {
  it('will report changed fields against checkpoint', async () => {
    class Profile extends Form {
      name = 'Gabe';
      age = 40;
    }

    const profile = Profile.new();
    await profile.set();

    expect(profile.changed()).toBeUndefined();

    profile.age = 41;
    await profile.set();

    expect(profile.changed()).toEqual({ age: 41 });
  });
});

describe('ownership', () => {
  it('will drop inputs and forms when destroyed', async () => {
    const input = new Input();
    const outer = provide(new Form()).inputs({ input });
    const inner = outer.nest(new Form());
    await outer.form.set();

    input.set(null);
    inner.form.set(null);

    expect(outer.form.inputs.size).toBe(0);
    expect(outer.form.nested.size).toBe(0);
  });
});

describe('source', () => {
  class Profile extends Form {
    name = '';
    age = 0;
  }

  it('will copy fields from `for`', () => {
    const source = { name: 'Gabe', age: 40, extra: true };
    const profile = Profile.new({ for: source });

    expect(profile.values()).toEqual({ name: 'Gabe', age: 40 });
  });

  it('will write changes back on accept', async () => {
    const source = { name: 'Gabe', age: 40 };
    const profile = Profile.new({ for: source });

    profile.age = 41;
    await profile.set();
    await profile.ready();

    expect(source).toEqual({ name: 'Gabe', age: 41 });
  });

  it('will ignore a non-object `for`', () => {
    const profile = Profile.new({ for: 'nope' });

    expect(profile.values()).toEqual({ name: '', age: 0 });
    expect(profile.accept(profile.values(), profile)).toBe(true);
  });
});

describe('nested values', () => {
  class Address extends Form {
    city = 'Miami';
  }

  class Profile extends Form {
    name = 'Gabe';
    address = new Address();
  }

  it('will collect nested values', () => {
    expect(Profile.new().values()).toEqual({
      name: 'Gabe',
      address: { city: 'Miami' }
    });
  });

  it('will report nested changes only when changed', async () => {
    const profile = Profile.new();
    await profile.set();

    expect(profile.changed()).toBeUndefined();

    profile.address.city = 'Tampa';
    await profile.address.set();

    expect(profile.changed()).toEqual({ address: { city: 'Tampa' } });
  });
});

it('will reset to checkpoint', async () => {
  class Profile extends Form {
    name = 'Gabe';
  }

  const profile = Profile.new();

  profile.name = 'Other';
  profile.reset();

  expect(profile.name).toBe('Gabe');
});

describe('ready', () => {
  it('will accept valid values', async () => {
    const accept = vi.fn((_values: object) => false);

    class Profile extends Form {
      name = 'Gabe';

      accept(values: object) {
        return accept(values);
      }
    }

    expect(await Profile.new().ready()).toBe(true);
    expect(accept).toHaveBeenCalledWith({ name: 'Gabe' });
  });

  it('will reject invalid inputs', async () => {
    const reject = vi.fn((_invalid: Set<Input>) => true);

    class Strict extends Form {
      reject(invalid: Set<Input>) {
        return reject(invalid);
      }
    }

    const required = new Input();
    const { form } = provide(new Strict()).inputs({ required });
    await form.set();

    expect(await form.ready()).toBe(true);
    expect(reject).toHaveBeenCalledWith(new Set([required]));
  });

  it('will not be ready when invalid by default', async () => {
    const { form } = provide(new Form()).inputs({ required: new Input() });
    await form.set();

    expect(await form.ready()).toBe(false);
  });
});

describe('input validity', () => {
  it('will accept a validator returning undefined or true', async () => {
    class Custom extends Input {
      valid() {
        return true;
      }
    }

    const filled = new Input();
    filled.value = 'x';
    filled.warning = true;

    const { form } = provide(new Form()).inputs({ filled, custom: new Custom() });
    await form.set();

    expect(await form.invalid()).toBeUndefined();
    expect(filled.warning).toBeUndefined();
  });

  it('will reject a validator returning false', async () => {
    class Never extends Input {
      valid() {
        return false;
      }
    }

    const never = new Never();
    never.warning = 'kept';

    const { form } = provide(new Form()).inputs({ never });
    await form.set();

    expect((await form.invalid())?.has(never)).toBe(true);
    expect(never.warning).toBe('kept');
  });

  it('will clear warning once value changes', async () => {
    const required = new Input();
    const { form } = provide(new Form()).inputs({ required });
    await form.set();
    await form.invalid();

    required.value = 'x';
    await required.set();

    expect(required.warning).toBeUndefined();
  });
});

describe('input binding', () => {
  class Profile extends Form {
    name = 'Gabe';
  }

  it('will expose form and key', () => {
    const profile = Profile.new();

    expect(profile.form.name()).toEqual([profile, 'name']);
  });

  it('will bind an input both ways', async () => {
    const profile = Profile.new();
    const field = Input.new();

    profile.form.name(field);

    expect(field.name).toBe('name');
    expect(field.value).toBe('Gabe');

    field.value = 'Other';
    await field.set();
    expect(profile.name).toBe('Other');

    profile.name = 'Again';
    await profile.set();
    expect(field.value).toBe('Again');
  });
});
