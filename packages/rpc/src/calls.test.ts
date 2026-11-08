import { expect, it } from "vitest";

it("will throw when imported outside the rpc() plugin's server", async () => {
  await expect(import("./calls")).rejects.toThrow("@expressive/rpc/calls is provided by the rpc() Vite plugin to the server it builds");
});
