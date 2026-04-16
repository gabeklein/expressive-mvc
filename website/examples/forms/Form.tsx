import { Component } from '@expressive/react';
import type { InputHTMLAttributes, Ref } from 'react';

// Form is a reusable Component - any subclass renders as a self-providing
// container for its fields. Shows how to extend the .get() static method
// for custom bindings without needing a separate library.
class Form extends Component {
  // Returns a ref that wires an <input> up to `property` on the nearest Form.
  // .get(fn) resolves the instance and memoizes the returned ref per component.
  static bind(property: string): Ref<HTMLInputElement> {
    return this.get((self) => {
      let reset: (() => void) | undefined;

      return (input) => {
        if (reset) reset();

        if (!input) return;

        if (!(property in self))
          throw new Error(`${self} has no property "${property}"`);

        const unfollow = self.get(property, (x) => (input.value = x as string));
        const onInput = () => self.set({ [property]: input.value });

        input.addEventListener('input', onInput);

        reset = () => {
          input.removeEventListener('input', onInput);
          unfollow();
        };
      };
    });
  }
}

// Reusable Input that binds to the nearest Form via context - no props
// for wiring state, just a name matching a property on the Form.
function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const ref = Form.bind(props.name!);

  return <input {...props} ref={ref} />;
}

export { Input, Form };
