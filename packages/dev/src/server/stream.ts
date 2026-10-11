import type { IncomingMessage, ServerResponse } from "node:http";

import { connect, listen } from "./connection";

export const STREAM = "/.expressive/stream";

export function isStream(req: IncomingMessage): boolean {
  return req.method === "GET" && new URL(req.url ?? "/", "http://localhost").pathname === STREAM;
}

export function stream(req: IncomingMessage, res: ServerResponse): void {
  const connection = connect(new URL(req.url!, "http://localhost").searchParams.get("connection"));

  if (!connection) {
    res.statusCode = 400;
    return void res.end();
  }

  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  res.flushHeaders();

  const close = listen(connection, (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

  req.on("close", close);
}
