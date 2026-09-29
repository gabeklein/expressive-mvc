import type { Component } from "@expressive/mvc";

export function NotFound(): Component.Node {
  return (
    <main style={{ font: "1rem/1.5 system-ui, sans-serif", padding: "2rem" }}>
      <h1>404 - Not found</h1>
      <p>
        No route matched. Add a <code>NotFound</code> export to replace this Expressive fallback.
      </p>
    </main>
  );
}
