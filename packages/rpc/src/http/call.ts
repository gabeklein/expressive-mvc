import { attempt, fault, inFolder, locate, type Call, type Endpoint, type Exports, type Match, type Outcome, type Seats } from "../call";
import { parse, stringify } from "../codec";
import { headersOf } from "../context";
import { ERRORS } from "../errors";

export function isCall(request: Request): boolean {
  const { headers } = request;
  const named = headers.has("x-expressive-call") || headers.has("x-expressive-get");

  return request.method === "POST" && named && !!headers.get("content-type")?.startsWith("application/json");
}

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

export interface HandlerOptions {
  dev?: boolean;
  seats?: Seats;
}

export function handler(endpoints: Endpoint[] | (() => Endpoint[]), { dev = false, seats }: HandlerOptions = {}): (request: Request) => Promise<Response | undefined> {
  const list = typeof endpoints == "function" ? endpoints : () => endpoints;

  return async request => (isCall(request) ? dispatch(request, list, dev, seats) : undefined);
}

const unseated: Seats = async () => undefined;

export async function dispatch<E extends Exports>(request: Request, endpoints: () => Endpoint<E>[], dev: boolean, seats = unseated, tier?: Tier<E>): Promise<Response> {
  const list = endpoints();
  const { pathname } = new URL(request.url);
  const at = pathname.split("/").filter(Boolean);
  const name = request.headers.has("x-expressive-get") ? undefined : request.headers.get("x-expressive-call") ?? undefined;
  const { found, exports, fn } = await locate(list, at, name);
  const incoming = { request, list, at, pathname, found, exports, dev, seats };
  const handle = tier ? await tier(incoming, fn) : fn && plain(incoming, fn);

  if (!handle) return reply(404, { message: "Not found." });

  const args = await readArgs(request);

  if (!args) return reply(400, { message: "Expected a JSON array of arguments." });

  return withHeaders(await handle(args), headersOf(request));
}

/** Add what the call set to its reply - the reply's own headers win. */
function withHeaders(response: Response, extra?: Headers): Response {
  if (!extra) return response;

  const headers = new Headers(response.headers);

  extra.forEach((value, name) => name === "set-cookie" || response.headers.has(name) || headers.set(name, value));

  for (const cookie of extra.getSetCookie()) headers.append("set-cookie", cookie);

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function plain(incoming: Incoming, fn: Call): Handle {
  return async args => respond(await attempt(() => inFolder(incoming, () => fn(...args)), incoming.list, incoming.dev, ERRORS));
}

async function readArgs(request: Request): Promise<unknown[] | undefined> {
  try {
    const args = parse(await request.text());
    return Array.isArray(args) ? args : undefined;
  } catch {
    return undefined;
  }
}

export async function failure(error: unknown, endpoints: Endpoint[], dev: boolean, headers?: Record<string, string>): Promise<Response> {
  return respond(await fault(error, endpoints, dev, ERRORS), headers);
}

function respond(outcome: Outcome, headers?: Record<string, string>): Response {
  if ("value" in outcome) return reply(200, { value: outcome.value }, headers);

  return reply(statusOf(outcome.status), outcome.error, headers);
}

function statusOf(status?: number): number {
  return status !== undefined && status >= 400 && status < 600 ? status : 500;
}

export function reply(status: number, value?: unknown, headers: Record<string, string> = {}): Response {
  if (value === undefined) return new Response(null, { status, headers });

  return new Response(stringify(value), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
}
