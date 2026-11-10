import { render } from "@expressive/dom";
import { jsx } from "@expressive/dom/jsx-runtime";
import { Context } from "@expressive/mvc";
import { BrowserRouter } from "@expressive/router";
import { afterEach, beforeEach } from "vitest";

// Imported up front, not inside mount(): a cold load of the dom and router sources under
// coverage can outlast the first test's timeout when every package runs at once.

let release: (() => void) | undefined;

afterEach(() => {
  release?.();
  release = undefined;
  if (typeof document !== "undefined") document.body.replaceChildren();
});

export async function mount(Type: any) {
  const container = document.createElement("div");
  document.body.append(container);
  release = render(jsx(Type, {}), container);
  await settle();
  return container;
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export const settle = () => tick().then(tick);

export function browserRouter() {
  const ctx = {} as { current: { set(value: null): void } };

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    ctx.current = BrowserRouter.new(Context.root);
  });

  afterEach(() => ctx.current && ctx.current.set(null));

  return ctx;
}

export const location = (path: string) => window.history.replaceState(null, "", path);
