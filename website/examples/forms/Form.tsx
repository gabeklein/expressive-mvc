import { Component, ref } from '@expressive/react';

// When creating something potentially reusable, it's
// often better to start with a base class to build from.
// 
// Form extends Component class to handle the logic of binding inputs
// to properties, and providing context for any nested components.
export class Form extends Component {

  // The ref instruction is a way to map over the known
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
  
  // For convenience, extending Form, you may want to do something
  // extra to bound inputs, so we'll put this in a separate method. 
  // For now, each input, will get name attribute from key, 
  // listen for input events and sync with value of property.
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