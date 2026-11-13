import { within, type Seat } from "./context";
import { rank } from "./segments";

export { rank };

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

const specificity = (pattern: string[]) => pattern.map(rank).join("");

export function resolve<E extends Exports>(endpoints: Endpoint<E>[], at: string[]): Match<E> | undefined {
  const matches: Match<E>[] = [];

  for (const endpoint of endpoints) {
    const segments = match(endpoint.pattern, at);
    if (segments) matches.push({ endpoint, segments });
  }

  return matches.sort((a, b) => specificity(b.endpoint.pattern).localeCompare(specificity(a.endpoint.pattern)))[0];
}

export type Call = (...args: unknown[]) => unknown;

export type Seats = (pattern: string[]) => Promise<Seat | undefined>;

export interface Invocation {
  request: Request;
  at: string[];
  name: string;
  args: unknown[];
}

export interface Fault {
  error?: string;
  message: string;
  stack?: string;
  [field: string]: unknown;
}

export type Outcome = { value: unknown } | { error: Fault; status?: number };

export interface Options {
  seats?: Seats;
  dev?: boolean;
  errors?: Record<string, unknown>;
}

export interface Located<E extends Exports = Exports> {
  found?: Match<E>;
  exports?: E;
  fn?: Call;
}

export interface Folder {
  request: Request;
  found?: Match;
  seats: Seats;
}

const unseated: Seats = async () => undefined;

export async function locate<E extends Exports>(list: Endpoint<E>[], at: string[], name?: string): Promise<Located<E>> {
  const found = resolve(list, at);
  const exports = found && await found.endpoint.exports();
  const fn = exports && name !== undefined ? callOf(exports, name) : undefined;

  return { found, exports, fn };
}

export async function invoke({ request, at, name, args }: Invocation, endpoints: Endpoint[], { seats = unseated, dev = false, errors }: Options = {}): Promise<Outcome | undefined> {
  const { found, fn } = await locate(endpoints, at, name);

  if (fn) return attempt(() => inFolder({ request, found, seats }, () => fn(...args)), endpoints, dev, errors);
}

export async function attempt(run: () => unknown, endpoints: Endpoint[], dev: boolean, errors?: Record<string, unknown>): Promise<Outcome> {
  try {
    return { value: await run() };
  } catch (error) {
    return fault(error, endpoints, dev, errors);
  }
}

export async function inFolder<T>({ request, found, seats }: Folder, run: () => T): Promise<Awaited<T>> {
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

export async function fault(error: unknown, endpoints: Endpoint[], dev: boolean, errors?: Record<string, unknown>): Promise<{ error: Fault; status?: number }> {
  if (!(error instanceof Error)) return { error: { message: "Internal error." } };

  const id = await classId(endpoints, error, errors);
  const { status } = error as { status?: unknown };

  if (id) return { error: { ...error, error: id, message: error.message }, status: typeof status == "number" ? status : undefined };
  if (dev) return { error: { message: error.message, stack: error.stack } };

  return { error: { message: "Internal error." } };
}

export async function classId(endpoints: Endpoint[], error: Error, errors: Record<string, unknown> = {}): Promise<string | undefined> {
  const ids = new Map<unknown, string>();

  for (const { exports } of endpoints)
    for (const [id, Type] of Object.entries((await exports()).classes)) ids.set(Type, id);

  for (const [id, Type] of Object.entries(errors)) ids.set(Type, id);

  for (let proto = Object.getPrototypeOf(error); proto; proto = Object.getPrototypeOf(proto))
    if (ids.has(proto.constructor)) return ids.get(proto.constructor);
}

export function verify(path: string, { classes }: Exports): void {
  for (const [id, Type] of Object.entries(classes)) {
    const isError = typeof Type == "function" && Type.prototype instanceof Error;
    const name = typeof Type == "function" ? Type.name : id;

    if (!isError) throw new Error(`${path} exports ${name}, which is neither an async function nor an Error subclass.`);
  }
}
