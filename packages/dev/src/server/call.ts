import { within, type Seat } from "./context";

export interface Exports {
  calls: Record<string, unknown>;
  classes: Record<string, unknown>;
}

export interface Endpoint<E extends Exports = Exports> {
  pattern: string[];
  exports(): Promise<E>;
}

export interface Match<E extends Exports = Exports> {
  endpoint: Endpoint<E>;
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

export function resolve<E extends Exports>(endpoints: Endpoint<E>[], at: string[]): Match<E> | undefined {
  const matches: Match<E>[] = [];

  for (const endpoint of endpoints) {
    const segments = match(endpoint.pattern, at);
    if (segments) matches.push({ endpoint, segments });
  }

  return matches.sort((a, b) => specificity(b.endpoint.pattern).localeCompare(specificity(a.endpoint.pattern)))[0];
}

export function isCall(request: Request): boolean {
  const { headers } = request;
  const named = headers.has("x-expressive-call") || headers.has("x-expressive-get");

  return request.method === "POST" && named && !!headers.get("content-type")?.startsWith("application/json");
}

export type Call = (...args: unknown[]) => unknown;

export type Seats = (pattern: string[]) => Promise<Seat | undefined>;

export interface Incoming<E extends Exports = Exports> {
  request: Request;
  list: Endpoint<E>[];
  at: string[];
  pathname: string;
  found?: Match<E>;
  exports?: E;
  dev: boolean;
  seats: Seats;
}

export type Handle = (args: unknown[]) => Promise<Response>;

export type Tier<E extends Exports> = (incoming: Incoming<E>, fn?: Call) => Promise<Handle | undefined>;

const unseated: Seats = async () => undefined;

export async function dispatch<E extends Exports>(request: Request, endpoints: () => Endpoint<E>[], dev: boolean, seats = unseated, tier?: Tier<E>): Promise<Response> {
  const list = endpoints();
  const { pathname } = new URL(request.url);
  const at = pathname.split("/").filter(Boolean);
  const found = resolve(list, at);
  const exports = found && await found.endpoint.exports();
  const name = request.headers.get("x-expressive-call");
  const fn = exports && name !== null ? callOf(exports, name) : undefined;
  const incoming = { request, list, at, pathname, found, exports, dev, seats };
  const handle = tier ? await tier(incoming, fn) : fn && plain(incoming, fn);

  if (!handle) return reply(404, { message: "Not found." });

  const args = await readArgs(request);

  if (!args) return reply(400, { message: "Expected a JSON array of arguments." });

  return handle(args);
}

function plain(incoming: Incoming, fn: Call): Handle {
  return async args => {
    try {
      return reply(200, { value: await inFolder(incoming, () => fn(...args)) });
    } catch (error) {
      return failure(error, incoming.list, incoming.dev);
    }
  };
}

export async function inFolder<T>({ request, found, seats }: Incoming, run: () => T): Promise<Awaited<T>> {
  const along = await seatsAlong(seats, found!.endpoint.pattern);

  return within(request, found!.segments, run, along);
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

export function seatsAlong(seats: Seats, pattern: string[]): Promise<(Seat | undefined)[]> {
  return Promise.all(Array.from({ length: pattern.length + 1 }, (_, i) => seats(pattern.slice(0, i))));
}

function callOf({ calls }: Exports, name: string): Call | undefined {
  const fn = Object.hasOwn(calls, name) ? calls[name] : undefined;

  return typeof fn === "function" ? (fn as Call) : undefined;
}

async function readArgs(request: Request): Promise<unknown[] | undefined> {
  try {
    const args: unknown = JSON.parse(await request.text());
    return Array.isArray(args) ? args : undefined;
  } catch {
    return undefined;
  }
}

export async function failure(error: unknown, endpoints: Endpoint[], dev: boolean, headers?: Record<string, string>): Promise<Response> {
  if (!(error instanceof Error)) return reply(500, { message: "Internal error." }, headers);

  const id = await classId(endpoints, error);

  if (id) return reply(statusOf(error), { ...error, error: id, message: error.message }, headers);
  if (dev) return reply(500, { message: error.message, stack: error.stack }, headers);

  return reply(500, { message: "Internal error." }, headers);
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

export function reply(status: number, value?: unknown, headers: Record<string, string> = {}): Response {
  if (value === undefined) return new Response(null, { status, headers });

  return new Response(JSON.stringify(value), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
}
