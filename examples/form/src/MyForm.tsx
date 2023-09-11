import { Provider } from '@expressive/react';
import React from 'react';

import { Alert, Form, Input } from './Form';

// Extend form for the basic logic, and load up on
// methods and values which fulfill your business logic.
class Control extends Form {
  constructor(){
    super();
    (window as any).form = this;
  }

  firstname = "";
  lastname = "";
  email = "";
}

const MyForm = () => {
  return (
    <Provider for={Control}>
      <Input name="firstname" placeholder="Firstname" />
      <Input name="lastname" placeholder="Lastname" />
      <Input name="email" placeholder="Email Address" />
      <Alert />
    </Provider>
  );
};

export default MyForm;
