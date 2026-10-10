// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/" }

import { afterEach, describe, expect, it, vi } from "vitest";

import { State } from "@expressive/mvc";

import { runtime } from "./call";

const { call, define, twin } = runtime(State);

function reply(status: number, body?: unknown) {
  const fetch = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("call", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState(null, "", "/");
  });

  it("will POST the arguments to the sidecar's folder, params filled from the location", async () => {
    history.replaceState(null, "", "/blog/hello/edit?draft=1");
    const fetch = reply(200, 3);

    expect(await call(["blog", ":slug"], "add", [1, 2])).toBe(3);
    expect(fetch).toHaveBeenCalledWith("/blog/hello", {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-call": "add" },
      body: "[1,2]",
    });
  });

  it("will fill a catch-all with the rest of the location", async () => {
    history.replaceState(null, "", "/docs/a/b");
    const fetch = reply(204);

    expect(await call(["docs", "*"], "none", [])).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith("/docs/a/b", expect.anything());
  });

  it("will throw a failed call's message", async () => {
    reply(500, { message: "Internal error." });
    await expect(call([], "fail", [])).rejects.toThrow("Internal error.");
  });

  it("will throw if called from outside the sidecar's folder", async () => {
    history.replaceState(null, "", "/about");
    const fetch = reply(200, 1);

    await expect(call(["blog", ":slug"], "add", [])).rejects.toThrow("add() belongs to /blog/:slug and cannot be called from /about.");
    await expect(call(["blog"], "add", [])).rejects.toThrow("belongs to /blog");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("will rebuild an exported error class with its fields", async () => {
    const Limit = define("/tally#Limit", "Limit");
    reply(409, { error: "/tally#Limit", message: "Over 3", status: 409, limit: 3 });

    const error = (await call([], "add", []).catch((e: Error) => e)) as Error;

    expect(error).toBeInstanceOf(Limit);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: "Limit", message: "Over 3", status: 409, limit: 3 });
  });

  it("will throw a plain Error for a class this client never imported", async () => {
    reply(409, { error: "/other#Nope", message: "No", status: 409 });

    const error = (await call([], "add", []).catch((e: Error) => e)) as Error;

    expect(error.constructor).toBe(Error);
    expect(error).toMatchObject({ message: "No", status: 409 });
  });
});

describe("twin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState(null, "", "/");
  });

  it("will make a named State whose methods call the server", async () => {
    history.replaceState(null, "", "/tally");
    const fetch = reply(200, 5);
    const Tally = twin(["tally"], { add: "default.add" }, "Tally");
    const tally = Tally.new() as any;

    expect(Tally.name).toBe("Tally");
    expect(tally).toBeInstanceOf(State);
    expect(await tally.add(2, 3)).toBe(5);
    expect(fetch).toHaveBeenCalledWith("/tally", expect.objectContaining({
      headers: expect.objectContaining({ "x-expressive-call": "default.add" }),
      body: "[2,3]",
    }));
  });
});
