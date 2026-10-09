import { describe, expect, it } from "vitest";

import * as client from "./browser";
import * as server from "./index";

describe("one surface", () => {
  it("will export the same names in the browser and on the server", () => {
    expect(Object.keys(client).sort()).toEqual(Object.keys(server).sort());
  });

  it("will export the server's serve over the browser stub", () => {
    expect(server.serve).not.toBe(client.serve);
  });

  it("will throw if serve is called in the browser", () => {
    expect(() => client.serve()).toThrow("server only");
  });
});
