import { describe, expect, it, vi } from "vitest";

import type { Endpoint } from "./call";
import { handler } from "./http/call";
import * as server from "./server";

describe("server build", () => {
  const add = vi.fn(async (a: number, b: number) => a + b);
  const endpoints: Endpoint[] = [{ pattern: ["tally"], exports: async () => ({ calls: { add }, classes: {} }) }];
  const transport = vi.fn(async (request: Request) => (await handler(endpoints)(request))!);

  it("will call through the shared client to an absolute base, with no page", async () => {
    server.configure({ base: "http://rpc.test", transport });

    expect(globalThis.location).toBeUndefined();
    expect(await server.call("/tally", "add", [2, 3])).toBe(5);
    expect(transport.mock.calls[0][0].url).toBe("http://rpc.test/tally");
  });

  it("will throw if a relative base has no page location to resolve against", async () => {
    await expect(server.client({ base: "/api" }).call("/tally", "add", [])).rejects.toThrow("a relative base needs a page location to resolve against");
  });
});
