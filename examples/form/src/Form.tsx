import { Model } from '@expressive/react';
import React, { InputHTMLAttributes, Ref } from 'react';

/*
  Form here will be an abstract Model which might be used to control
  *any* form in a hypothetical application. It will be used to
  demonstrate how to extend the Model.get static method to make a
  custom Model usable in different ways.

  How this works can be completely up to you.
  Mainly we want to show you might not need to delegate to library
  for simple features as you build an app.
*/
class Form extends Model {
  /*
    For reusability, we create a static method to abstract
    the process of binding an <input> to a property on the model.

    Here the `this.get()` [read: Form.get static method]
    will create a ref-function that will be used by React.

    Not only will `.get()` fetch the nearest instance of Form,
    it will pass that instance to a function, which will then
    return result and be memoized by component going forward.
  */
  static createRef(property: string): Ref<HTMLInputElement> {
    return this.get(self => {
      let reset: (() => void) | undefined;

      return (input) => {
        if(reset)
          reset();

        if(!input)
          return;

        if(property in self == false)
          throw new Error(`${self} has no property "${property}"`);

        const unfollow = self.get(current => {
          input.value = current[property];
        });

        const onInput = () => self[property] = input.value;

        input.addEventListener("input", onInput);

        reset = () => {
          input.removeEventListener("input", onInput);
          unfollow();
        };
      }
    })
  }
}

/*
  Next, we create a reusable Input component to used
  in conjunction with Form. This allows us to create a
  reusable component which can communicate with any Model
  to extend (or contains) the Form class. This way, there's
  no need to pass props for controlling the input.
*/
const Input = (props: InputHTMLAttributes<HTMLInputElement>) => {
  const ref = Form.createRef(props.name!);

  return (
    <input {...props} ref={ref} />
  );
};

export { Input, Form };
