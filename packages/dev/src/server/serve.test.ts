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
});
