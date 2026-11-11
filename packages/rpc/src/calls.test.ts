import { afterEach, expect, it } from "vitest";

import { handle } from "./calls";

const DEV = Symbol.for("@expressive/rpc/calls#dev");

afterEach(() => void delete (globalThis as Record<symbol, unknown>)[DEV]);

it("will throw outside a server the rpc() plugin builds or runs", async () => {
  await expect(handle(new Request("http://localhost/"))).rejects.toThrow("@expressive/rpc/calls answers only in a server the rpc() Vite plugin builds or runs");
});

it("will hand a request to the dev server's tree", async () => {
  const response = new Response("dev");

  Object.assign(globalThis, { [DEV]: { handle: async () => response } });

  expect(await handle(new Request("http://localhost/"))).toBe(response);
});
