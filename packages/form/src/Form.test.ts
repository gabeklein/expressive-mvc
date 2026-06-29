import { Context } from '@expressive/mvc';
import { describe, expect, it } from 'bun:test';

import { Form } from './Form';
import { Input } from './Input';

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
