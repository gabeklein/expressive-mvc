import type { IncomingMessage, ServerResponse } from "node:http";

import { within } from "./context";

export interface Exports {
  calls: Record<string, unknown>;
  classes: Record<string, unknown>;
}

export interface Endpoint {
  pattern: string[];
  exports(): Promise<Exports>;
}

export interface Match {
  endpoint: Endpoint;
  segments: string[];
}

function match(pattern: string[], at: string[]): string[] | undefined {
  if (pattern.at(-1) !== "*" && pattern.length !== at.length) return;

  const segments: string[] = [];

  for (const [i, part] of pattern.entries()) {
    if (part === "*") {
      segments.push(at.slice(i).join("/"));
      continue;
    }

    if (at[i] === undefined) return;
    if (!part.startsWith(":") && part !== at[i]) return;

    segments.push(at[i]);
  }

  return segments;
}

const rank = (part: string) => (part === "*" ? 0 : part.startsWith(":") ? 1 : 2);
const specificity = (pattern: string[]) => pattern.map(rank).join("");

export function resolve(endpoints: Endpoint[], at: string[]): Match | undefined {
  const matches: Match[] = [];

  for (const endpoint of endpoints) {
    const segments = match(endpoint.pattern, at);
    if (segments) matches.push({ endpoint, segments });
  }

  return matches.sort((a, b) => specificity(b.endpoint.pattern).localeCompare(specificity(a.endpoint.pattern)))[0];
}

export function isCall(req: IncomingMessage): boolean {
  const name = req.headers["x-expressive-call"];
  const json = req.headers["content-type"]?.startsWith("application/json");

  return req.method === "POST" && typeof name === "string" && !!json;
}

type Call = (...args: unknown[]) => unknown;

export async function dispatch(req: IncomingMessage, res: ServerResponse, endpoints: () => Endpoint[], dev: boolean): Promise<void> {
  const list = endpoints();
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const found = resolve(list, pathname.split("/").filter(Boolean));
  const fn = found && await lookup(found.endpoint, req.headers["x-expressive-call"] as string);

  if (!found || !fn) return reply(res, 404, { message: "Not found." });

  const args = await readArgs(req);

  if (!args) return reply(res, 400, { message: "Expected a JSON array of arguments." });

  try {
    const value = await within(req, found.segments, () => fn(...args));
    return value === undefined ? reply(res, 204) : reply(res, 200, value);
  } catch (error) {
    const { status, body } = await failure(error, list, dev);
    return reply(res, status, body);
  }
}

async function lookup(endpoint: Endpoint, name: string): Promise<Call | undefined> {
  const { calls } = await endpoint.exports();
  const fn = Object.hasOwn(calls, name) ? calls[name] : undefined;

  return typeof fn === "function" ? (fn as Call) : undefined;
}

async function readArgs(req: IncomingMessage): Promise<unknown[] | undefined> {
  try {
    const args: unknown = JSON.parse(await text(req));
    return Array.isArray(args) ? args : undefined;
  } catch {
    return undefined;
  }
}

async function failure(error: unknown, endpoints: Endpoint[], dev: boolean): Promise<{ status: number; body: unknown }> {
  if (!(error instanceof Error)) return { status: 500, body: { message: "Internal error." } };

  const id = await classId(endpoints, error);

  if (id) return { status: statusOf(error), body: { ...error, error: id, message: error.message } };
  if (dev) return { status: 500, body: { message: error.message, stack: error.stack } };

  return { status: 500, body: { message: "Internal error." } };
}

async function classId(endpoints: Endpoint[], error: Error): Promise<string | undefined> {
  const ids = new Map<unknown, string>();

  for (const { exports } of endpoints)
    for (const [id, Type] of Object.entries((await exports()).classes)) ids.set(Type, id);

  for (let proto = Object.getPrototypeOf(error); proto; proto = Object.getPrototypeOf(proto))
    if (ids.has(proto.constructor)) return ids.get(proto.constructor);
}

function statusOf(error: Error): number {
  const { status } = error as { status?: unknown };
  const valid = typeof status == "number" && status >= 400 && status < 600;

  return valid ? status : 500;
}

export function verify(path: string, { classes }: Exports): void {
  for (const [id, Type] of Object.entries(classes)) {
    const isError = typeof Type == "function" && Type.prototype instanceof Error;
    const name = typeof Type == "function" ? Type.name : id;

    if (!isError) throw new Error(`${path} exports ${name}, which is neither an async function nor an Error subclass.`);
  }
}

async function text(req: IncomingMessage): Promise<string> {
  let out = "";
  for await (const chunk of req) out += chunk;
  return out;
}

function reply(res: ServerResponse, status: number, value?: unknown): void {
  const body = value === undefined ? undefined : JSON.stringify(value);

  res.statusCode = status;
  if (body !== undefined) res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}
