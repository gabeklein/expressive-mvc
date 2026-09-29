import { afterEach, beforeEach } from "vitest";

let release: (() => void) | undefined;

afterEach(() => {
  release?.();
  release = undefined;
  if (typeof document !== "undefined") document.body.replaceChildren();
});

export async function mount(Type: any) {
  const { render } = await import("@expressive/dom");
  const { jsx } = await import("@expressive/dom/jsx-runtime");
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

  beforeEach(async () => {
    const { BrowserRouter } = await import("@expressive/router");
    window.history.replaceState(null, "", "/");
    ctx.current = BrowserRouter.new();
  });

  afterEach(() => ctx.current && ctx.current.set(null));

  return ctx;
}

export const location = (path: string) => window.history.replaceState(null, "", path);
