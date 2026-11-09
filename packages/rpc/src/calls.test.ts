import { afterEach, expect, it } from "vitest";

import { handle, within } from "./calls";

const DEV = Symbol.for("@expressive/rpc/calls#dev");

afterEach(() => void delete (globalThis as Record<symbol, unknown>)[DEV]);

it("will throw outside a server the rpc() plugin builds or runs", async () => {
  await expect(within("account", () => 1)).rejects.toThrow("@expressive/rpc/calls answers only");
  await expect(handle(new Request("http://localhost/"))).rejects.toThrow("@expressive/rpc/calls answers only in a server the rpc() Vite plugin builds or runs");
});

it("will hand a request and a folder's code to the dev server's calls", async () => {
  const response = new Response("dev");

  Object.assign(globalThis, { [DEV]: { handle: async () => response, within: async (folder: string, run: () => string) => `${folder}:${run()}` } });

  expect(await handle(new Request("http://localhost/"))).toBe(response);
  expect(await within("account", () => "ran")).toBe("account:ran");
});
