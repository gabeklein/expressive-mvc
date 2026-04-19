import { Form } from "./Form";

// Simple component to show live values for any form.
export function Preview() {
  // We don't even need `MyForm` per se, since no special behavior.
  // Just access the nearest of any `Form` and display it's values.
  const form = Form.get();
  const values = {} as Record<string, any>;

  for (const key in form)
    // By directly accessing properties, we subscribe to changes.
    // Now, values will keep up with values set by inputs.
    values[key] = (form as any)[key];

  return (
    <pre>{JSON.stringify(values, null, 2)}</pre>
  );
}
