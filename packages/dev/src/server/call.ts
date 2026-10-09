import type { IncomingMessage, ServerResponse } from "node:http";

export interface Endpoint {
  pattern: string[];
  calls(): Promise<Record<string, unknown>>;
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

  const calls = await endpoint(endpoints(), new URL(req.url ?? "/", "http://localhost").pathname)?.calls();
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
    return reply(res, 500, dev && error instanceof Error ? { message: error.message, stack: error.stack } : { message: "Internal error." });
  }
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
