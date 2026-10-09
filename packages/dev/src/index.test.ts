import { describe, expect, it } from "vitest";

import * as client from "./browser";
import * as server from "./index";

describe("one surface", () => {
  it("will export the same names in the browser and on the server", () => {
    expect(Object.keys(client).sort()).toEqual(Object.keys(server).sort());
  });

  it("will throw if serve is called in the browser", () => {
    expect(() => client.serve()).toThrow("server only");
  });

  it("will throw if Current is made in the browser", () => {
    expect(() => new client.Current()).toThrow("Current is server-only.");
  });
});
