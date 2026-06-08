import { Component, ref } from '@expressive/react';

// Base class: binds inputs and provides context to children.
export class Form extends Component {

  // Use `ref` instruction to map over known keys of `this`,
  // running a factory per key. Returns land at `this.input[key]`
  // - here, ref-functions that two-way bind each input.
  input = ref(this, (key) => {
    let reset: (() => void) | undefined;

    return (el: HTMLInputElement | null) => {
      if (reset) reset();
      if (!el) return;
      reset = this.bind(el, key);
    }
  })
  
  // Bind input to its matching property; set name from key.
  // Separate method so subclasses could override.
  public bind(input: HTMLInputElement, key: keyof this) {
    if (!(key in this) || typeof key !== "string")
      throw new Error(`${this} has no property "${String(key)}"`);

    if(!input.name) input.name = key;

    const onInput = () => {
      (this as any)[key] = input.value;
    };
    const unwatch = this.get(key, () => {
      input.value = this[key] as string;
    });

    input.addEventListener('input', onInput);

    return () => {
      input.removeEventListener('input', onInput);
      unwatch();
    };
  }
}