import type { IncomingMessage, ServerResponse } from "node:http";

import { seated, within, type Seat } from "./context";
import { changedSince, snapshot, versionOf } from "./version";

export interface Exports {
  calls: Record<string, unknown>;
  classes: Record<string, unknown>;
  seat?: { fields: string[]; methods: Record<string, string> };
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
  const name = req.headers["x-expressive-call"] ?? req.headers["x-expressive-get"];
  const json = req.headers["content-type"]?.startsWith("application/json");

  return req.method === "POST" && typeof name === "string" && !!json;
}

type Call = (...args: unknown[]) => unknown;

export type Seats = (pattern: string[]) => Promise<Seat | undefined>;

const unseated: Seats = async () => undefined;

export async function dispatch(req: IncomingMessage, res: ServerResponse, endpoints: () => Endpoint[], dev: boolean, seats = unseated): Promise<void> {
  const list = endpoints();
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const found = resolve(list, pathname.split("/").filter(Boolean));
  const exports = found && await found.endpoint.exports();
  const pull = req.headers["x-expressive-get"] as string | undefined;
  const name = req.headers["x-expressive-call"] as string;
  const method = exports?.seat && Object.hasOwn(exports.seat.methods, name) ? exports.seat.methods[name] : undefined;
  const fn = !pull && !method && exports ? callOf(exports, name) : undefined;

  if (!found || !exports || !(fn || method || pull === "default" && exports.seat)) return reply(res, 404, { message: "Not found." });

  const args = await readArgs(req);

  if (!args) return reply(res, 400, { message: "Expected a JSON array of arguments." });

  const { fields } = exports.seat ?? { fields: [] };

  try {
    const along = await seatsAlong(seats, found.endpoint.pattern);

    if (pull) {
      const since = req.headers["if-none-match"] as string | undefined;
      const result = await within(req, found.segments, () => {
        const seat = seated()!;
        snapshot(seat, fields);
        const keys = changedSince(seat, since, fields);
        const version = versionOf(seat);

        return keys.length || version !== since ? { values: snapshot(seat, keys), version } : undefined;
      }, along);

      return result ? reply(res, 200, result) : reply(res, 304);
    }

    if (method) {
      const result = await within(req, found.segments, async () => {
        const seat = seated()!;
        snapshot(seat, fields);
        const before = versionOf(seat);
        const value = await (seat as any)[method](...args);

        return { value, patch: snapshot(seat, changedSince(seat, before, fields)), version: versionOf(seat) };
      }, along);

      return reply(res, 200, result);
    }

    const value = await within(req, found.segments, () => fn!(...args), along);
    return value === undefined ? reply(res, 204) : reply(res, 200, value);
  } catch (error) {
    const { status, body } = await failure(error, list, dev);
    return reply(res, status, body);
  }
}

function seatsAlong(seats: Seats, pattern: string[]): Promise<(Seat | undefined)[]> {
  return Promise.all(Array.from({ length: pattern.length + 1 }, (_, i) => seats(pattern.slice(0, i))));
}

function callOf({ calls }: Exports, name: string): Call | undefined {
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
