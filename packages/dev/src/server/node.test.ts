import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { send, toRequest } from "./node";

function incoming(method: string | undefined, url: string | undefined, headers: Record<string, string | string[] | undefined>, chunks: string[] = []) {
  return Object.assign(Readable.from(chunks.map(chunk => Buffer.from(chunk))), { method, url, headers }) as any;
}

function outgoing() {
  return Object.assign(new EventEmitter(), { statusCode: 0, setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), end: vi.fn() }) as any;
}

describe("node request", () => {
  it("will carry the method, absolute URL and headers", () => {
    const request = toRequest(incoming("POST", "/tally?x=1", { host: "example.com", "x-a": "1", accept: ["a", "b"], none: undefined }), outgoing());

    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://example.com/tally?x=1");
    expect(request.headers.get("x-a")).toBe("1");
    expect(request.headers.get("accept")).toBe("a, b");
    expect(request.headers.has("none")).toBe(false);
  });

  it("will default to a GET of the root on localhost, without a body", () => {
    const request = toRequest(incoming(undefined, undefined, {}), outgoing());

    expect(request.method).toBe("GET");
    expect(request.url).toBe("http://localhost/");
    expect(request.body).toBeNull();
  });

  it("will read the body from the incoming stream", async () => {
    const request = toRequest(incoming("POST", "/", {}, ["[1, ", "2]"]), outgoing());

    expect(await request.json()).toEqual([1, 2]);
  });

  it("will abort its signal when the response closes", () => {
    const res = outgoing();
    const request = toRequest(incoming("GET", "/", {}), res);

    expect(request.signal.aborted).toBe(false);
    res.emit("close");
    expect(request.signal.aborted).toBe(true);
  });
});

describe("node response", () => {
  it("will write the status and headers, and end an empty body", async () => {
    const res = outgoing();

    await send(res, new Response(null, { status: 304, headers: { "x-a": "1" } }));

    expect(res.statusCode).toBe(304);
    expect(res.setHeader).toHaveBeenCalledWith("x-a", "1");
    expect(res.flushHeaders).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

  it("will flush headers, then write the body as it streams", async () => {
    const res = outgoing();

    await send(res, new Response("hello", { status: 200 }));

    expect(res.flushHeaders).toHaveBeenCalled();
    expect(Buffer.concat(res.write.mock.calls.map(([chunk]: [Uint8Array]) => chunk)).toString()).toBe("hello");
    expect(res.end).toHaveBeenCalled();
  });
});
