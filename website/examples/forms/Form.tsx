import { Component, ref } from '@expressive/react';

// Base class: binds inputs and provides context to children.
export class Form extends Component {

  // The `ref` instruction is a way to map over the known
  // keys of `this` instance and run a factory for each.
  // Whatever we return is assigned to `this.input[key]` so we
  // can make a ref-function to two-way bind input elements.
  input = ref(this, (key) => {
    let reset: (() => void) | undefined;

    return (el: HTMLInputElement | null) => {
      if (reset) reset();
      if (!el) return;
      reset = this.bind(el, key);
    }
  })
  
  // Separate method so subclasses can override. Binds each input
  // to the property matching its key; sets name attribute as well.
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