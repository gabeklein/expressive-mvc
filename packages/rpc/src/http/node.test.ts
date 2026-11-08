import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { send, toNode, toRequest } from "./node";

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

  it("will leave the incoming stream untouched until its body is read", async () => {
    const req = incoming("POST", "/", {}, ["first", "second"]);

    toRequest(req, outgoing());
    await new Promise(done => setTimeout(done, 10));

    expect(req.listenerCount("readable")).toBe(0);

    let read = "";
    for await (const chunk of req) read += chunk;

    expect(read).toBe("firstsecond");
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

  it("will send each cookie as its own header", async () => {
    const res = outgoing();
    const headers = new Headers({ "x-a": "1" });
    headers.append("set-cookie", "a=1; HttpOnly");
    headers.append("set-cookie", "b=2");

    await send(res, new Response(null, { status: 204, headers }));

    expect(res.setHeader).toHaveBeenCalledWith("set-cookie", ["a=1; HttpOnly", "b=2"]);
    expect(res.setHeader).toHaveBeenCalledWith("x-a", "1");
    expect(res.setHeader).toHaveBeenCalledTimes(2);
  });

  it("will end a JSON body at once, so it goes with its length", async () => {
    const res = outgoing();

    await send(res, new Response('{"a":1}', { status: 200, headers: { "content-type": "application/json" } }));

    expect(res.flushHeaders).not.toHaveBeenCalled();
    expect(res.write).not.toHaveBeenCalled();
    expect(Buffer.from(res.end.mock.calls[0][0]).toString()).toBe('{"a":1}');
  });

  it("will flush any other body's headers, then write each chunk as it arrives", async () => {
    const res = outgoing();
    const encoder = new TextEncoder();
    let next!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: controller => void (next = controller) });

    next.enqueue(encoder.encode('{"done":1}\n'));
    const sent = send(res, new Response(body, { status: 200, headers: { "content-type": "application/x-ndjson" } }));

    await vi.waitFor(() => expect(res.write).toHaveBeenCalledTimes(1));
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();

    next.enqueue(encoder.encode('{"done":2}\n'));
    next.close();
    await sent;

    expect(Buffer.concat(res.write.mock.calls.map(([chunk]: [Uint8Array]) => chunk)).toString()).toBe('{"done":1}\n{"done":2}\n');
    expect(res.end).toHaveBeenCalled();
  });
});

describe("node handler", () => {
  const settled = () => new Promise(done => setTimeout(done, 0));

  it("will send what the handler replies", async () => {
    const res = outgoing();
    const next = vi.fn();

    toNode(async request => new Response(request.url, { status: 201 }))(incoming("GET", "/a", {}), res, next);
    await settled();

    expect(res.statusCode).toBe(201);
    expect(Buffer.concat(res.write.mock.calls.map(([chunk]: [Uint8Array]) => chunk)).toString()).toBe("http://localhost/a");
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("will pass on a request the handler leaves, or reply 404 with nowhere to pass it", async () => {
    const next = vi.fn();
    const res = outgoing();

    toNode(async () => undefined)(incoming("GET", "/", {}), outgoing(), next);
    toNode(async () => undefined)(incoming("GET", "/", {}), res);
    await settled();

    expect(next).toHaveBeenCalledWith();
    expect(res.statusCode).toBe(404);
    expect(res.end).toHaveBeenCalled();
  });

  it("will pass on a handler's error, or reply 500 with nowhere to pass it", async () => {
    const error = new Error("Boom");
    const next = vi.fn();
    const res = outgoing();

    toNode(async () => { throw error; })(incoming("GET", "/", {}), outgoing(), next);
    toNode(async () => { throw error; })(incoming("GET", "/", {}), res);
    await settled();

    expect(next).toHaveBeenCalledWith(error);
    expect(res.statusCode).toBe(500);
    expect(res.end).toHaveBeenCalled();
  });

  it("will pass on an error sending the reply", async () => {
    const error = new Error("Closed");
    const res = Object.assign(outgoing(), { setHeader: () => { throw error; } });
    const next = vi.fn();

    toNode(async () => new Response("a", { headers: { "x-a": "1" } }))(incoming("GET", "/", {}), res, next);
    await settled();

    expect(next).toHaveBeenCalledWith(error);
  });
});
