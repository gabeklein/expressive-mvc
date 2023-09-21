import { Model } from '@expressive/react';
import React, { InputHTMLAttributes, Ref } from 'react';

/*
  Form here will be a Model which may be used to control
  *any* form in a hypothetical application. It will be used to
  demonstrate how to extend the Model.get static method to make a
  custom Model usable in different ways.

  How this works can be completely up to you.
  Mainly we want to show there's no need to delegate
  for simple features as you build an app.
*/
class Form extends Model {
  /*
    For reusability, create a static method to wrap process
    for binding an <input> (or textarea) to a property on a model.

    Here `this.get()` [read: Form.get static method]
    will create a ref-function that will be used by React.

    Not only will `.get()` fetch the nearest instance of Form,
    it will pass that instance to a function, which will then
    return a result and be memoized by component going forward.
  */
  static bind(property: string): Ref<HTMLInputElement> {
    return this.get(form => {
      let reset: (() => void) | undefined;

      return (input) => {
        if(reset)
          reset();

        if(!input)
          return;

        if(!(property in form))
          throw new Error(`${form} has no property "${property}"`);

        const unfollow = form.get(property, x => input.value = x as string);
        const onInput = () => form.set(property, input.value);

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
  styled component which can communicate with any Model
  to extend (or contains) the Form class. This way, there's
  no need to pass any props for controlling the input.
*/
const Input = (props: InputHTMLAttributes<HTMLInputElement>) => {
  const ref = Form.bind(props.name!);

  return (
    <input {...props} ref={ref} />
  );
};

export { Input, Form };
