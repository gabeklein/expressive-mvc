import { Provider } from '@expressive/react';
import React from 'react';

import { Alert, Form, Input } from './Form';

// You can extend Form for the basic logic and load up on
// methods and values which fulfill your business logic.
class Control extends Form {
  firstname = "";
  lastname = "";
  email = "";
}

const MyForm = () => {
  // In order to for this to work, we will need to provide a
  // controller downstream. Here that's pretty easy as <Provider />
  // will both create and add a new Control instance to context.
  return (
    <Provider for={Control}>
      <h1>Example Form</h1>
      <Input name="firstname" placeholder="Firstname" />
      <Input name="lastname" placeholder="Lastname" />
      <Input name="email" placeholder="Email Address" />
      <Alert />
    </Provider>
  );
};

export default MyForm;
