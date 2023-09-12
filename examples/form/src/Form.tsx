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
    For reusability, we'll create a static method that will
    abstract away the process of binding any particular <input>
    to a property on the model.

    Here the `this.get()` [read: Model.get static method]
    will create a Ref function that will be used by React.

    Not only will `.get()` fetch the nearest instance of Form,
    it will pass that instance to a function, which will then
    create the ref to be memoized by component going forward.
  */
  static createRef(property: string): Ref<HTMLInputElement> {
    return this.get(self => {
      let done: (() => void) | undefined;

      return (input) => {
        if(done)
          done();

        if(input && property in self){
          const unfollow = self.get((state) => {
            input.value = state[property];          });

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

/*
  Next, we create a reusable Input component to be used
  in conjunction with Form. This allows us to create a
  reusable component which can communicate with any Model
  to extend (or contains) the Form class.
*/
const Input = (props: InputHTMLAttributes<HTMLInputElement>) => {
  const ref = Form.createRef(props.name!);

  return (
    <input {...props} ref={ref} />
  );
};

/*
  Likewise we create a button which will respond to a click
  by alerting the current values in the form. This is a one-off
  so we'll use the Form.get directly.
*/
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
