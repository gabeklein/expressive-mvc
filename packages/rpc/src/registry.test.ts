import { describe, expect, it } from "vitest";

import { registry } from "./registry";

describe("registry", () => {
  it("will define a named Error class for an id, and rebuild a fault as it", () => {
    const { define, rebuild } = registry();
    const Limit = define("/tally#Limit", "Limit");
    const error = rebuild({ error: "/tally#Limit", message: "Over 3", stack: "hidden", limit: 3 });

    expect(Limit.name).toBe("Limit");
    expect(error).toBeInstanceOf(Limit);
    expect(error).toMatchObject({ name: "Limit", message: "Over 3", limit: 3 });
    expect(error).not.toHaveProperty("stack", "hidden");
  });

  it("will rebuild a known id as its class, and anything else as Error", () => {
    class Known extends Error {}
    const { rebuild } = registry({ "fixed:Known": Known });

    expect(rebuild({ error: "fixed:Known", message: "a" })).toBeInstanceOf(Known);
    expect(rebuild({ error: "/other#Nope", message: "b" }).constructor).toBe(Error);
    expect(rebuild({ message: "c" }).constructor).toBe(Error);
  });
});
