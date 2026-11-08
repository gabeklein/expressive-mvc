import type { IncomingMessage, ServerResponse } from "node:http";

export function toRequest(req: IncomingMessage, res: ServerResponse): Request {
  const method = req.method ?? "GET";
  const aborted = new AbortController();
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers))
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);

  res.on("close", () => aborted.abort());

  let chunks: AsyncIterator<Buffer> | undefined;

  const body = method === "GET" || method === "HEAD" ? null : new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await (chunks ??= req[Symbol.asyncIterator]()).next();

      if (done) controller.close();
      else controller.enqueue(value);
    },
  }, { highWaterMark: 0 });

  return new Request(new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`), {
    method,
    headers,
    body,
    signal: aborted.signal,
    duplex: "half",
  } as RequestInit);
}

export async function send(res: ServerResponse, response: Response): Promise<void> {
  const cookies = response.headers.getSetCookie();

  res.statusCode = response.status;
  response.headers.forEach((value, name) => name !== "set-cookie" && res.setHeader(name, value));

  if (cookies.length) res.setHeader("set-cookie", cookies);
  if (!response.body) return void res.end();
  if (response.headers.get("content-type")?.startsWith("application/json")) return void res.end(Buffer.from(await response.arrayBuffer()));

  res.flushHeaders();

  const reader = response.body.getReader();

  for (let read = await reader.read(); !read.done; read = await reader.read()) res.write(read.value);

  res.end();
}

export function toNode(handler: (request: Request) => Promise<Response | undefined>) {
  return (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void): void => {
    handler(toRequest(req, res))
      .then(response => {
        if (response) return send(res, response);
        if (next) return next();

        res.statusCode = 404;
        res.end();
      })
      .catch(error => {
        if (next) return next(error);

        res.statusCode = 500;
        res.end();
      });
  };
}
