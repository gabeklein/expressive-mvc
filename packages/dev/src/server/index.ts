import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";

import type { AppConfig } from "../config";

export type ApiModule = Record<string, unknown>;
export type Api = Record<string, () => Promise<ApiModule>>;

export interface Scope {
  pattern: string[];
  load: () => Promise<ApiModule>;
}

export interface Reply {
  status: number;
  body: string;
}

export const API_PREFIX = "/api";

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

const json = (status: number, value: unknown): Reply => ({ status, body: JSON.stringify(value ?? null) });

export async function dispatch(api: Api, method: string, path: string, body: () => Promise<string>): Promise<Reply> {
  if (method !== "GET" && method !== "POST") return json(405, { error: "Use GET or POST." });

  const segments = path.split("/").filter(Boolean);
  const name = segments.pop();
  const key = segments.join("/");
  const load = name === undefined ? undefined : api[key];

  if (!load) return json(404, { error: `No api module "${key}".` });

  const fn = (await load())[name!];

  if (typeof fn !== "function") return json(404, { error: `No function "${name}" in api module "${key}".` });

  return invoke(fn as Function, method === "POST" ? body : undefined);
}

async function invoke(fn: Function, body?: () => Promise<string>, before: Function[] = []): Promise<Reply> {
  let args: unknown[] = [];

  if (body) {
    const text = await body();

    try {
      args = text ? JSON.parse(text) : [];
    } catch {
      return json(400, { error: "Body must be JSON." });
    }

    if (!Array.isArray(args)) return json(400, { error: "Body must be a JSON array of arguments." });
  }

  try {
    for (const hook of before) await hook();
    return json(200, await fn(...args));
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
}

const RANK = (segment: string) => (segment === "*" ? 1 : segment.startsWith(":") ? 2 : 3);

function matches(pattern: string[], segments: string[]): boolean {
  if (pattern.at(-1) === "*") {
    if (segments.length < pattern.length) return false;
  } else if (segments.length !== pattern.length) return false;

  return pattern.every((part, i) => part === "*" || part.startsWith(":") || part === segments[i]);
}

function specific(a: Scope, b: Scope): number {
  for (let i = 0; i < Math.max(a.pattern.length, b.pattern.length); i++) {
    const diff = RANK(b.pattern[i] ?? "*") - RANK(a.pattern[i] ?? "*");
    if (diff) return diff;
  }

  return 0;
}

const within = (outer: string[], inner: string[]) =>
  outer.length <= inner.length && outer.every((part, i) => part === inner[i]);

const isClass = (fn: Function) => /^class[\s{]/.test(Function.prototype.toString.call(fn));

export async function dispatchScope(
  scopes: Scope[],
  method: string,
  path: string,
  body: () => Promise<string>
): Promise<Reply | undefined> {
  if (method !== "POST") return;

  const segments = path.split("/").filter(Boolean);
  const name = segments.pop();
  const target = name && scopes.filter(scope => matches(scope.pattern, segments)).sort(specific)[0];

  if (!target) return;

  const fn = name === "default" ? undefined : (await target.load())[name];

  if (typeof fn !== "function") return json(404, { error: `No function "${name}" at /${target.pattern.join("/")}.` });

  const chain = scopes
    .filter(scope => within(scope.pattern, target.pattern))
    .sort((a, b) => a.pattern.length - b.pattern.length);

  const hooks: Function[] = [];

  for (const scope of chain) {
    const hook = (await scope.load()).default;
    if (typeof hook === "function" && !isClass(hook)) hooks.push(hook);
  }

  return invoke(fn, body, hooks);
}

export async function text(req: IncomingMessage): Promise<string> {
  let out = "";
  for await (const chunk of req) out += chunk;
  return out;
}

export function send(res: ServerResponse, reply: Reply): void {
  res.statusCode = reply.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(reply.body);
}

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
  api: Api;
  scopes?: Scope[];
  config: AppConfig;
  client: string;
}

export function serve({ api, scopes = [], config, client }: ServeOptions): Server {
  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";

    if (pathname === API_PREFIX || pathname.startsWith(API_PREFIX + "/"))
      return send(res, await dispatch(api, method, pathname.slice(API_PREFIX.length), () => text(req)));

    const reply = await dispatchScope(scopes, method, pathname, () => text(req));
    if (reply) return send(res, reply);

    if (sendFile(res, client, pathname) || sendFile(res, client, "/index.html")) return;

    res.statusCode = 404;
    res.end("Not found");
  });

  const port = config.port ?? 3000;
  server.listen(port, () => console.log(`Expressive running at http://localhost:${port}/`));

  return server;
}
