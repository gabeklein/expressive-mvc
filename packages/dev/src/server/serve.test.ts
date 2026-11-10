import { describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import { connect } from "node:net";
import { Agent, request } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sendFile, serve } from "./serve";

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

describe("serve", () => {
  it("will reply 400 to a request it cannot read, and keep serving", async () => {
    const dir = mkdtempSync(join(tmpdir(), "client-"));
    writeFileSync(join(dir, "index.html"), "<html></html>");
    vi.spyOn(console, "log").mockImplementation(() => {});

    const server = serve({ config: { port: 0 }, client: dir });
    await new Promise(done => server.once("listening", done));

    const { port } = server.address() as AddressInfo;
    const raw = (head: string) => new Promise<string>(done => {
      const socket = connect({ port }, () => void socket.write(`${head}\r\nConnection: close\r\n\r\n`));
      let out = "";
      socket.on("data", chunk => (out += chunk));
      socket.on("close", () => done(out.split("\r\n")[0]));
    });

    expect(await raw("GET / HTTP/1.1\r\nHost: a:b")).toBe("HTTP/1.1 400 Bad Request");
    expect(await raw("GET http://[ HTTP/1.1\r\nHost: x")).toBe("HTTP/1.1 400 Bad Request");
    expect(await raw("GET / HTTP/1.1\r\nHost: x")).toBe("HTTP/1.1 200 OK");

    const agent = new Agent({ keepAlive: true, maxSockets: 1 });
    const send = (method: string, path: string, headers: Record<string, string> = {}, body?: string) => new Promise<number>((done, fail) => {
      const req = request({ port, method, path, agent, headers, timeout: 2000 }, res => (res.resume(), done(res.statusCode!)));
      req.on("timeout", () => fail(new Error("timed out")));
      req.end(body);
    });

    const call = { "content-type": "application/json", "x-expressive-call": "add" };

    expect(await send("POST", "/nowhere", call, `[${"1,".repeat(100_000)}1]`)).toBe(404);
    expect(await send("GET", "/")).toBe(200);

    agent.destroy();
    server.close();
    vi.restoreAllMocks();
  });

  it("will serve a page's index.html, else the 200.html shell", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const dir = mkdtempSync(join(tmpdir(), "client-"));
    mkdirSync(join(dir, "about"));
    writeFileSync(join(dir, "index.html"), "home");
    writeFileSync(join(dir, "200.html"), "shell");
    writeFileSync(join(dir, "about", "index.html"), "about");

    const server = serve({ config: { port: 0 }, client: dir });
    await new Promise(done => server.once("listening", done));

    const base = `http://localhost:${(server.address() as AddressInfo).port}`;
    const text = async (path: string) => (await fetch(base + path)).text();

    expect(await text("/")).toBe("home");
    expect(await text("/about")).toBe("about");
    expect(await text("/about/")).toBe("about");
    expect(await text("/blog/hello")).toBe("shell");

    server.closeAllConnections();
    server.close();
    vi.restoreAllMocks();
  });

  it("will reply 404 with no file and no shell", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const server = serve({ config: { port: 0 }, client: mkdtempSync(join(tmpdir(), "client-")) });
    await new Promise(done => server.once("listening", done));

    const { port } = server.address() as AddressInfo;
    const status = await new Promise<number>(done => request({ port, path: "/" }, res => (res.resume(), done(res.statusCode!))).end());

    expect(status).toBe(404);

    server.close();
    vi.restoreAllMocks();
  });

  it("will check sidecars before it listens, on port 3000 by default", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const exports = vi.fn(async () => ({ calls: {}, classes: { Oops: class Oops extends Error {} } }));

    const server = serve({ config: {}, client: tmpdir(), sidecars: [{ pattern: ["todos"], exports } as any] });
    const listen = vi.spyOn(server, "listen").mockImplementation(((port: number, done: () => void) => (done(), server)) as any);

    await vi.waitFor(() => expect(listen).toHaveBeenCalled());

    expect(exports).toHaveBeenCalled();
    expect(listen.mock.calls[0][0]).toBe(3000);
    expect(log).toHaveBeenCalledWith("Expressive running at http://localhost:3000/");

    vi.restoreAllMocks();
  });

  it("will serve the stream, a seated call, and a file of unknown type", async () => {
    const { Model } = await import("@expressive/mvc");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const dir = mkdtempSync(join(tmpdir(), "client-"));
    writeFileSync(join(dir, "data.bin"), "1");

    const exports = async () => ({ calls: { add: async (a: number, b: number) => a + b }, classes: {} });
    const server = serve({ config: { port: 0 }, client: dir, sidecars: [{ pattern: ["tally"], exports } as any], seats: [{ pattern: ["tally"], Type: class Tally extends Model {} as any }] });
    await new Promise(done => server.once("listening", done));

    const base = `http://localhost:${(server.address() as AddressInfo).port}`;
    const abort = new AbortController();
    const stream = await fetch(`${base}/.expressive/stream?connection=${crypto.randomUUID()}`, { signal: abort.signal });
    const call = await fetch(`${base}/tally`, { method: "POST", headers: { "content-type": "application/json", "x-expressive-connection": crypto.randomUUID(), "x-expressive-call": "add" }, body: "[2, 3]" });
    const file = await fetch(`${base}/data.bin`);

    expect(stream.headers.get("content-type")).toBe("text/event-stream");
    expect(await call.json()).toMatchObject({ value: 5 });
    expect(file.headers.get("content-type")).toBe("application/octet-stream");

    abort.abort();
    server.closeAllConnections();
    server.close();
    vi.restoreAllMocks();
  });
});
