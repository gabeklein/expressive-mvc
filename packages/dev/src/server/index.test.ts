import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dispatch, sendFile, type Api } from ".";

const api: Api = {
  "": async () => ({ ping: () => "pong" }),
  greetings: async () => ({
    hello: async (name = "World") => `Hello ${name}!`,
    fail: () => { throw new Error("as requested"); },
    count: 3,
  }),
  "blog/posts": async () => ({ list: () => ["a", "b"] }),
};

const call = (method: string, path: string, body = "") => dispatch(api, method, path, async () => body);
const parsed = async (method: string, path: string, body?: string) => {
  const reply = await call(method, path, body);
  return { status: reply.status, value: JSON.parse(reply.body) };
};

describe("api dispatch", () => {
  it("GET calls with no arguments", async () => {
    expect(await parsed("GET", "/greetings/hello")).toEqual({ status: 200, value: "Hello World!" });
  });

  it("POST passes the JSON array body as arguments", async () => {
    expect(await parsed("POST", "/greetings/hello", '["Gabe"]')).toEqual({ status: 200, value: "Hello Gabe!" });
  });

  it("an empty POST body means no arguments", async () => {
    expect(await parsed("POST", "greetings/hello")).toEqual({ status: 200, value: "Hello World!" });
  });

  it("the api index serves at the root, nested folders by path", async () => {
    expect(await parsed("GET", "/ping")).toEqual({ status: 200, value: "pong" });
    expect(await parsed("GET", "/blog/posts/list")).toEqual({ status: 200, value: ["a", "b"] });
  });

  it("undefined results serialize as null", async () => {
    const quiet: Api = { q: async () => ({ noop: () => {} }) };
    expect((await dispatch(quiet, "GET", "/q/noop", async () => "")).body).toBe("null");
  });

  it("will 404 for an unknown module or a non-function export", async () => {
    expect((await call("GET", "/nope/x")).status).toBe(404);
    expect((await call("GET", "/greetings/count")).status).toBe(404);
    expect((await call("GET", "/")).status).toBe(404);
  });

  it("will 400 for a body that is not a JSON array", async () => {
    expect((await call("POST", "/greetings/hello", "{}")).status).toBe(400);
    expect((await call("POST", "/greetings/hello", "nope")).status).toBe(400);
  });

  it("will 405 for other methods", async () => {
    expect((await call("DELETE", "/greetings/hello")).status).toBe(405);
  });

  it("will 500 with the message when the function throws", async () => {
    expect(await parsed("POST", "/greetings/fail")).toEqual({ status: 500, value: { error: "as requested" } });
  });
});

describe("static files", () => {
  const dir = mkdtempSync(join(tmpdir(), "client-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<html></html>");
  writeFileSync(join(dir, "assets", "app.js"), "1");

  const response = () => {
    const headers: Record<string, string> = {};
    let ended = false;
    const res = {
      statusCode: 0,
      setHeader: (k: string, v: string) => { headers[k] = v; },
      end: () => { ended = true; },
      on: () => res,
      once: () => res,
      emit: () => true,
      write: () => true,
      headers,
      get ended() { return ended; },
    };
    return res;
  };

  it("sends a file under the directory with its type; assets are immutable", () => {
    const res = response();
    expect(sendFile(res as any, dir, "/assets/app.js")).toBe(true);
    expect(res.headers["Content-Type"]).toContain("javascript");
    expect(res.headers["Cache-Control"]).toContain("immutable");
  });

  it("will not serve a missing file, a directory, or a path outside the directory", () => {
    expect(sendFile(response() as any, dir, "/nope.js")).toBe(false);
    expect(sendFile(response() as any, dir, "/assets")).toBe(false);
    expect(sendFile(response() as any, dir, "/../" + dir.split("/").pop() + "/index.html")).toBe(false);
    expect(sendFile(response() as any, join(dir, "assets"), "/../index.html")).toBe(false);
  });
});
