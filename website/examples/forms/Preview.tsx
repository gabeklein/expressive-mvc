import { Form } from "./Form";

// Simple component to show live values for any form.
export function Preview() {
  // We don't even need `MyForm` per se, since no special behavior.
  // Just access the nearest of any `Form` and display it's values.
  const form = Form.get();
  const values = {} as Record<string, any>;

  for (const key in form)
    // Accessing properties subscribes to changes.
    values[key] = (form as any)[key];

  return (
    <pre>{JSON.stringify(values, null, 2)}</pre>
  );
}
