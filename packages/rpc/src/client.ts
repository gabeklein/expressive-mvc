import { parse, stringify } from "./codec";
import { registry } from "./registry";
import { ERRORS } from "./errors";

export {
  BadRequest,
  Conflict,
  Forbidden,
  Gone,
  HttpError,
  InternalError,
  MethodNotAllowed,
  NotFound,
  NotImplemented,
  PayloadTooLarge,
  PaymentRequired,
  Redirect,
  ServiceUnavailable,
  TooManyRequests,
  Unauthorized,
  UnprocessableEntity,
} from "./errors";

const ABSOLUTE = /^[a-z][a-z\d+.-]*:/i;

export type Transport = (request: Request) => Promise<Response>;

export interface ClientOptions {
  base?: string;
  transport?: Transport;
  headers?(): Record<string, string>;
  reply?(res: Response): Promise<void>;
}

export function client(initial: ClientOptions = {}) {
  const options = { ...initial };
  const { define, rebuild } = registry(ERRORS);

  function configure(next: ClientOptions): void {
    Object.assign(options, next);
  }

  function pathOf(pattern: string[], name: string, from = globalThis.location?.pathname): string {
    if (from === undefined)
      throw new Error(`Cannot fill /${pattern.join("/")} for ${name}() - a pattern needs a page location to read its params from. Pass the path to fill from as pathOf's third argument.`);

    const at = from.split("/").filter(Boolean);
    const path = pattern.map((part, i) => {
      if (part === "*") return at.slice(i).join("/");

      const matches = at[i] !== undefined && (part.startsWith(":") || part === at[i]);

      if (!matches)
        throw new Error(`${name}() belongs to /${pattern.join("/")} and cannot be called from ${from}.`);

      return at[i];
    });

    return "/" + path.join("/");
  }

  async function send(path: string, headers: Record<string, string>, body: unknown): Promise<any> {
    const { base = "", transport } = options;
    const url = base + path;

    if (!ABSOLUTE.test(url) && !globalThis.location)
      throw new Error(`Cannot send to ${url} - a relative base needs a page location to resolve against. Pass an absolute base: configure({ base: "https://api.example.com" }).`);

    const init = {
      method: "POST",
      headers: { "content-type": "application/json", ...options.headers?.(), ...headers },
      body: stringify(body),
    };
    const res = await (transport ? transport(new Request(new URL(url, globalThis.location?.href), init)) : fetch(url, init));

    await options.reply?.(res);

    return settle(res);
  }

  async function settle(res: Response): Promise<any> {
    if (res.status === 304) return;

    const body = parse(await res.text()) as any;

    if (res.ok) return body;

    throw rebuild(body);
  }

  async function call(path: string, name: string, args: unknown[]): Promise<unknown> {
    const reply = await send(path, { "x-expressive-call": name }, args);

    return reply.value;
  }

  return { call, configure, define, pathOf, send };
}

export const { call, configure, define } = client();
