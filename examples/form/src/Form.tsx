import { Model } from '@expressive/react';
import React, { FC, InputHTMLAttributes, Ref } from 'react';

/*
  Form here will be an abstract Model which might be used to control
  *any* form in a hypothetical application. It will be used to
  demonstrate how to extend the Model.get static method to make a
  custom Model usable in different ways.

  How this works can be completely up to you.
  Mainly we want to show you might not need to delegate to library
  for simple features as you build an app.
*/
abstract class Form extends Model {
  /*
    For reusability, we'll create a static method that will
    abstract away the process of binding any particular <input>
    to a property on the model.
  */
  static createRef(property: string): Ref<HTMLInputElement> {
    /*
      Here we'll use the this.get() [read: Model.get static method]
      to create a Ref function that will be used by React.
  
      Not only will `.get()` fetch the nearest instance of Form,
      it will pass that instance to a function, which will then
      create the ref to be memoized by component going forward.
    */
    return this.get(self => {
      let done: (() => void) | undefined;

      return (input) => {
        if(done)
          done();

        if(input && property in self){
          const unfollow = self.get((state) => {
            if(input.value !== state[property])
              input.value = state[property];
          });

          const onInput = () => self[property] = input.value;

          input.addEventListener("input", onInput);

          done = () => {
            input.removeEventListener("input", onInput);
            unfollow();
          };
        }
      }
    })
  }
}

declare namespace Input {
  type Props = InputHTMLAttributes<HTMLInputElement> & { name: string };
}

const Input: FC<Input.Props> = (props) => {
  const property = Form.createRef(props.name);

  return (
    <input {...props} ref={property} />
  );
};

const Alert = () => {
  const alertValues = Form.get(form => {
    return () => {
      const values = JSON
        .stringify(form.get(), null, 2)
        .replace(/[",]/g, "")
        .slice(2, -2);

      alert(`Current values in form are:\n\n` + values);
    }
  })

  return (
    <button onClick={alertValues}>Show Values</button>
  );
}

export { Alert, Input, Form };
