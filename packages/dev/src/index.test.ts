import { describe, expect, it } from "vitest";

import * as client from "./browser";
import * as server from "./index";

describe("one surface", () => {
  it("will export the same names in the browser and on the server", () => {
    expect(Object.keys(client).sort()).toEqual(Object.keys(server).sort());
  });

  it("will export server implementations over the browser stubs", () => {
    expect(server.serve).not.toBe(client.serve);
    expect(server.config).not.toBe(client.config);
  });

  it("will throw if server-only exports are called in the browser", () => {
    expect(() => client.serve()).toThrow("server only");
    expect(() => client.config({})).toThrow("server only");
  });
});
