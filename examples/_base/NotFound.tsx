import { Router } from "@expressive/router";

export function NotFound() {
  const { path } = Router.get();

  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <h1>404</h1>
      <p>No example matches <code>{path}</code>.</p>
    </div>
  );
}
