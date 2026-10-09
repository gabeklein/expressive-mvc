import type { IncomingMessage, ServerResponse } from "node:http";

export interface Exports {
  calls: Record<string, unknown>;
  classes: Record<string, unknown>;
}

export interface Endpoint {
  pattern: string[];
  exports(): Promise<Exports>;
}

const rank = (part: string) => (part === "*" ? 0 : part[0] === ":" ? 1 : 2);

export function endpoint(endpoints: Endpoint[], pathname: string): Endpoint | undefined {
  const at = pathname.split("/").filter(Boolean);

  return endpoints
    .filter(({ pattern }) =>
      (pattern.at(-1) === "*" || pattern.length === at.length) &&
      pattern.every((part, i) => part === "*" || at[i] !== undefined && (part[0] === ":" || part === at[i])))
    .sort((a, b) => b.pattern.map(rank).join("").localeCompare(a.pattern.map(rank).join("")))[0];
}

export async function dispatch(req: IncomingMessage, res: ServerResponse, endpoints: () => Endpoint[], dev: boolean): Promise<boolean> {
  const name = req.headers["x-expressive-call"];

  if (req.method !== "POST" || typeof name !== "string" || !req.headers["content-type"]?.startsWith("application/json"))
    return false;

  const list = endpoints();
  const calls = (await endpoint(list, new URL(req.url ?? "/", "http://localhost").pathname)?.exports())?.calls;
  const fn = calls && Object.hasOwn(calls, name) ? calls[name] : undefined;

  if (typeof fn !== "function") return reply(res, 404, { message: "Not found." });

  let args: unknown;

  try {
    args = JSON.parse(await text(req));
  } catch {}

  if (!Array.isArray(args)) return reply(res, 400, { message: "Expected a JSON array of arguments." });

  try {
    const value = await fn(...args);
    return value === undefined ? reply(res, 204) : reply(res, 200, value);
  } catch (error) {
    const id = error instanceof Error && await classId(list, error);

    if (id) return reply(res, status(error), { ...error, error: id, message: (error as Error).message });

    return reply(res, 500, dev && error instanceof Error ? { message: error.message, stack: error.stack } : { message: "Internal error." });
  }
}

async function classId(endpoints: Endpoint[], error: Error): Promise<string | undefined> {
  const ids = new Map<unknown, string>();

  for (const { pattern, exports } of endpoints)
    for (const [name, Type] of Object.entries((await exports()).classes))
      ids.set(Type, `/${pattern.join("/")}#${name}`);

  for (let proto = Object.getPrototypeOf(error); proto; proto = Object.getPrototypeOf(proto))
    if (ids.has(proto.constructor)) return ids.get(proto.constructor);
}

function status(error: Error): number {
  const { status } = error as { status?: unknown };
  return typeof status == "number" && status >= 400 && status < 600 ? status : 500;
}

export function verify(path: string, { classes }: Exports): void {
  for (const [name, Type] of Object.entries(classes))
    if (!(typeof Type == "function" && Type.prototype instanceof Error))
      throw new Error(`${path} exports ${name}, which is neither an async function nor an Error subclass.`);
}

async function text(req: IncomingMessage): Promise<string> {
  let out = "";
  for await (const chunk of req) out += chunk;
  return out;
}

function reply(res: ServerResponse, status: number, value?: unknown): true {
  const body = value === undefined ? undefined : JSON.stringify(value);

  res.statusCode = status;
  if (body !== undefined) res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);

  return true;
}
