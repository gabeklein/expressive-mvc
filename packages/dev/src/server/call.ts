import type { IncomingMessage, ServerResponse } from "node:http";

import { State } from "@expressive/mvc";

import { begin, catchUp, connect, end, frameOf, hold, release, renew, twinOf, type Connection, type Shape } from "./connection";
import { construct, seated, within, type Seat } from "./context";

export interface Exports {
  calls: Record<string, unknown>;
  classes: Record<string, unknown>;
  seat?: Shape & { methods: Record<string, string> };
  pool?: Record<string, Pooled>;
}

export interface Pooled extends Shape {
  Type: State.Type;
  methods: Record<string, string>;
}

export const DETACHED = "/.expressive/detached";

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
  const at = pathname.split("/").filter(Boolean);
  const found = resolve(list, at);
  const exports = found && await found.endpoint.exports();
  const pull = req.headers["x-expressive-get"] as string | undefined;
  const name = req.headers["x-expressive-call"] as string;
  const method = exports?.seat && Object.hasOwn(exports.seat.methods, name) ? exports.seat.methods[name] : undefined;
  const fn = !pull && !method && exports ? callOf(exports, name) : undefined;
  const seatPull = pull === "default" && !!exports?.seat;
  const pooled = fn || method || seatPull ? undefined : await pooledOf(list, pull, name);

  if (!pooled && !(fn || method || seatPull)) return reply(res, 404, { message: "Not found." });

  const args = await readArgs(req);

  if (!args) return reply(res, 400, { message: "Expected a JSON array of arguments." });

  const connection = connect(req.headers["x-expressive-connection"]);

  if (!connection) return reply(res, 400, { message: "Expected an x-expressive-connection id." });

  res.setHeader("x-expressive-epoch", connection.epoch);
  release(connection, req.headers["x-expressive-release"]);

  const twin = pull || method || pooled ? twinOf(req.headers["x-expressive-twin"]) : undefined;

  if ((pull || method || pooled) && !twin) return reply(res, 400, { message: "Expected an x-expressive-twin id." });

  const held = twin ? connection.twins.get(twin) : undefined;
  const mismatch = pooled ? held && held.pool?.id !== pooled.id || pooled.method && !held : held?.pool;

  if (mismatch) return reply(res, 404, { message: "Not found." });

  const since = req.headers["if-none-match"] as string | undefined;

  if (!pull) begin(connection);

  try {
    const result = pooled
      ? await inPool(req, connection, pooled, twin!, since, args, list, seats, at)
      : await atFolder(req, connection, found!, exports!, { pull, method, fn, twin, since, args, pathname }, seats);

    return result ? reply(res, 200, result) : reply(res, 304);
  } catch (error) {
    if (error instanceof Moved) return reply(res, 409, { message: error.message });

    const { status, body } = await failure(error, list, dev);
    return reply(res, status, body);
  } finally {
    if (!pull) end(connection);
  }
}

class Moved extends Error {
  message = "This twin's context was replaced - its instance is gone.";
}

interface Request {
  pull?: string;
  method?: string;
  fn?: Call;
  twin?: string;
  since?: string;
  args: unknown[];
  pathname: string;
}

async function atFolder(req: IncomingMessage, connection: Connection, found: Match, exports: Exports, request: Request, seats: Seats) {
  const { pull, method, fn, twin, since, args, pathname } = request;
  const shape = exports.seat ?? { fields: [] };
  const along = await seatsAlong(seats, found.endpoint.pattern);

  return within(req, found.segments, async () => {
    const seat = seated();

    if (seat) renew(connection, pathname, seat);
    if (twin) hold(connection, twin, pathname, seat!, shape, since);
    if (pull) return caughtUp(connection, twin!);

    const value = await (method ? invoke(seat!, method, args) : fn!(...args));

    return { value, frame: frameOf(connection) };
  }, along);
}

interface Target extends Pooled {
  id: string;
  method?: string;
}

async function inPool(req: IncomingMessage, connection: Connection, target: Target, twin: string, since: string | undefined, args: unknown[], list: Endpoint[], seats: Seats, at: string[]) {
  const off = "/" + at.join("/") === DETACHED;
  const walk = off ? { segments: [], pattern: [] } : walkOf(list, at);
  const along = off ? [] : await seatsAlong(seats, walk.pattern);
  const address = "/" + at.join("/");

  return within(req, walk.segments, async () => {
    const held = connection.twins.get(twin);

    if (held && !held.pool!.current()) {
      release(connection, twin);
      throw new Moved();
    }

    const built = held ? undefined : construct(target.Type, off);
    const instance = held ? held.instance : built!.instance;

    hold(connection, twin, address, instance, target, since, held?.pool ?? { id: target.id, drop: built!.drop, current: built!.current });

    if (!target.method) return caughtUp(connection, twin);

    const value = await invoke(instance, target.method, args);

    return { value, frame: frameOf(connection) };
  }, along);
}

function caughtUp(connection: Connection, twin: string) {
  const frame = catchUp(connection, twin);
  return Object.keys(frame).length ? { frame } : undefined;
}

function invoke(instance: State, method: string, args: unknown[]): unknown {
  const path = method.split(".");
  const name = path.pop()!;
  let target: unknown = instance;

  for (const field of path) target = (target as any)[field];

  if (!(target instanceof State)) throw new Error(`${path.join(".")} is not set on ${instance}.`);

  return (target as any)[name](...args);
}

async function pooledOf(list: Endpoint[], pull: string | undefined, name: string): Promise<Target | undefined> {
  for (const endpoint of list) {
    const pool = (await endpoint.exports()).pool ?? {};

    if (pull) {
      if (Object.hasOwn(pool, pull)) return { id: pull, ...pool[pull] };
      continue;
    }

    for (const [id, entry] of Object.entries(pool))
      if (Object.hasOwn(entry.methods, name)) return { id, ...entry, method: entry.methods[name] };
  }
}

export function walkOf(list: Endpoint[], at: string[]): { pattern: string[]; segments: string[] } {
  const pattern: string[] = [];
  const segments: string[] = [];

  for (let i = 0; i < at.length; i++) {
    const here = list.filter(endpoint => endpoint.pattern.length === i + 1);
    const exact = resolve(here.filter(endpoint => endpoint.pattern[i] !== "*"), at.slice(0, i + 1));
    const rest = !exact && resolve(here, at);

    if (rest) {
      pattern.push("*");
      segments.push(rest.segments[i]);
      break;
    }

    pattern.push(exact ? exact.endpoint.pattern[i] : at[i]);
    segments.push(at[i]);
  }

  return { pattern, segments };
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
