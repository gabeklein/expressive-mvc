import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import { connect } from "./connection";
import { isStream, stream } from "./stream";

function request(url: string, method = "GET") {
  return Object.assign(new EventEmitter(), { url, method });
}

function response() {
  return { statusCode: 0, writeHead: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), end: vi.fn() };
}

describe("stream", () => {
  it("will identify a GET of the stream path, whatever its query", () => {
    expect(isStream(request("/.expressive/stream?connection=x") as any)).toBe(true);
    expect(isStream(request("/.expressive/stream", "POST") as any)).toBe(false);
    expect(isStream(request("/.expressive/streams") as any)).toBe(false);
    expect(isStream(Object.assign(request(""), { url: undefined }) as any)).toBe(false);
  });

  it("will reply 400 without a connection id", () => {
    const res = response();

    stream(request("/.expressive/stream") as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.end).toHaveBeenCalled();
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("will hold the response open as an event stream on the tab's connection, until the request closes", () => {
    const id = crypto.randomUUID();
    const req = request(`/.expressive/stream?connection=${id}`);
    const res = response();

    stream(req as any, res as any);

    const connection = connect(id)!;

    expect(res.writeHead).toHaveBeenCalledWith(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(`event: hello\ndata: {"epoch":"${connection.epoch}"}\n\n`);
    expect(connection.sink).toBeDefined();

    req.emit("close");
    expect(connection.sink).toBeUndefined();
  });
});
