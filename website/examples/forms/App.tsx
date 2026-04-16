import { Form, Input } from './Form';

// Extending Form inherits its bind logic; we just declare the fields.
// Rendering <Control> both instantiates and provides it to children.
class Control extends Form {
  firstname = '';
  lastname = '';
  email = '';
}

export default function Demo() {
  return (
    <Control>
      <h1>Example Form</h1>
      <Input name="firstname" placeholder="Firstname" />
      <Input name="lastname" placeholder="Lastname" />
      <Input name="email" placeholder="Email Address" />
      <Alert />
    </Control>
  );
}

// Form.get(fn) resolves the nearest instance and memoizes the returned
// callback, closing over it - no re-subscription per render.
function Alert() {
  const alertValues = Form.get((form) => () => {
    const values = JSON.stringify(form.get(), null, 2)
      .replace(/[",]/g, '')
      .slice(2, -2);

    alert(`Current values in form are:\n\n` + values);
  });

  return <button onClick={alertValues}>Show Values</button>;
}
