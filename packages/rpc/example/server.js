import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { toNode } from "@expressive/rpc/http";

import server from "./dist/server/index.js";

const client = join(import.meta.dirname, "dist/client");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
// server.ts answers first - calls and its own routes; what it leaves is the static client.
const app = toNode(request => server.fetch(request));

createServer((req, res) => app(req, res, () => {
  const path = join(client, normalize(new URL(req.url, "http://localhost").pathname));
  const file = path.startsWith(client) && existsSync(path) && statSync(path).isFile() ? path : join(client, "index.html");

  res.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
  createReadStream(file).pipe(res);
})).listen(Number(process.env.PORT) || 3000);
