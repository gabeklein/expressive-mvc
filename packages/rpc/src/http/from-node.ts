import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";

import { track, type Params } from "../context";
import { NotFound } from "../errors";

/** A Node handler - an Express app or `Router()`, Connect middleware, or a bare `(req, res)`. */
export type NodeHandler = {
  // A method's parameters are bivariant, so Express's own `req` and `res` types are taken as Node's.
  handle(req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): unknown;
}["handle"];

const EMPTY = new Set([204, 205, 304]);

/**
 * A Node handler as a route's method: `export const GET = fromNode(router)`. It sees the path below the
 * route - under `[...].ts`, the rest - with `req.originalUrl` the whole of it, and runs in the request's
 * scope behind the folder's gates. What it writes streams out as written; `next()` is a 404, `next(error)`
 * fails as a throw would. Node only.
 */
export function fromNode(handler: NodeHandler): (request: Request, params?: Params) => Promise<Response> {
  return (request, params = {}) => new Promise<Response>((resolve, reject) => {
    const url = new URL(request.url);
    let started = false;
    let body: ReadableStreamDefaultController<Uint8Array> | undefined;
    let complete!: () => void;
    const finished = new Promise<void>(resolve => (complete = resolve));

    // What `res` writes: its status line and headers - whole, in the first write - which become the Response, then the body.
    // Readable too, or `on-finished` (body parsers) takes the request for done before it is read.
    const socket = new Duplex({
      read() {},
      write(chunk: Buffer, _, done) {
        if (!started) {
          chunk = chunk.subarray(chunk.indexOf("\r\n\r\n") + 4);
          started = true;
          respond();
        }

        if (chunk.length) body?.enqueue(new Uint8Array(chunk));
        done();
      },
    });

    const req = new IncomingMessage(socket as never);
    const res = new ServerResponse(req);

    req.method = request.method;
    req.url = "/" + (params["*"] ?? "") + url.search;
    Object.assign(req, { originalUrl: url.pathname + url.search });
    req.headers = Object.fromEntries(request.headers);

    // A body of unknown length came chunked, as far as body parsers can tell - they skip one that says neither.
    if (request.body && !req.headers["content-length"]) req.headers["transfer-encoding"] ??= "chunked";

    req.rawHeaders = Object.entries(req.headers).flat() as string[];
    res.useChunkedEncodingByDefault = false;
    res.shouldKeepAlive = false;
    res.assignSocket(socket as never);

    function respond() {
      const headers = new Headers();

      for (const [name, value] of Object.entries(res.getHeaders()))
        for (const each of [value!].flat()) headers.append(name, String(each));

      const empty = EMPTY.has(res.statusCode) || request.method === "HEAD";
      const stream = empty ? null : new ReadableStream<Uint8Array>({ start: controller => void (body = controller), cancel: () => void res.destroy() });

      const response = new Response(stream, { status: res.statusCode, statusText: res.statusMessage, headers });
      track(response, finished);
      resolve(response);
    }

    res.on("finish", () => {
      body?.close();
      complete();
    });
    res.on("close", () => {
      if (res.writableFinished) return;

      const error = new Error(`${request.method} ${url.pathname} closed before its response was done.`);

      body?.error(error);
      reject(error);
      complete();
    });
    request.signal.addEventListener("abort", () => res.destroy());

    (async () => {
      const reader = request.body?.getReader();

      for (let read = await reader?.read(); read && !read.done; read = await reader!.read()) req.push(read.value);
      req.push(null);
    })().catch(error => {
      req.destroy(error);
      reject(error);
    });

    try {
      handler(req, res, error => (error === undefined ? reject(new NotFound(`No route at ${url.pathname}.`)) : reject(error)));
    } catch (error) {
      reject(error);
    }
  });
}
