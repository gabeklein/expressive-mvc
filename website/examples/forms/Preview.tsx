import { Form } from "./Form";

// Simple component to show live values for any form.
export function Preview() {
  // Access the nearest Form instance - MyForm included.
  const form = Form.get();
  const values = {} as Record<string, any>;

  for (const key in form)
    // Accessed properties subscribe to updates.
    values[key] = (form as any)[key];

  return (
    <pre>{JSON.stringify(values, null, 2)}</pre>
  );
}
