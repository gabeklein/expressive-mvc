import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";

import type { AppConfig } from "./config";
import { dispatch, isCall, verify, type Endpoint } from "./call";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

export function sendFile(res: ServerResponse, dir: string, pathname: string): boolean {
  const file = join(dir, normalize(decodeURIComponent(pathname)));

  if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) return false;

  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
  if (pathname.startsWith("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  createReadStream(file).pipe(res);

  return true;
}

export interface ServeOptions {
  config: AppConfig;
  client: string;
  sidecars?: Endpoint[];
}

export function serve({ config, client, sidecars = [] }: ServeOptions): Server {
  const server = createServer(async (req, res) => {
    if (isCall(req)) return dispatch(req, res, () => sidecars, false);

    const { pathname } = new URL(req.url ?? "/", "http://localhost");

    if (sendFile(res, client, pathname) || sendFile(res, client, "/index.html")) return;

    res.statusCode = 404;
    res.end("Not found");
  });

  const port = config.port ?? 3000;
  const announce = () => console.log(`Expressive running at http://localhost:${port}/`);
  const checked = sidecars.map(async ({ pattern, exports }) => {
    const path = `/${pattern.join("/")}`;
    verify(path, await exports());
  });

  Promise.all(checked).then(() => server.listen(port, announce));

  return server;
}
