import { Model } from "@expressive/mvc";

import { active, outgoingOf } from "./context";

export interface CookieOptions {
  /** Seconds until it expires. */
  maxAge?: number;
  expires?: Date;
  /** Defaults to `/`. */
  path?: string;
  domain?: string;
  /** Defaults to true when the request came over https. */
  secure?: boolean;
  /** Defaults to true - client code cannot read it. */
  httpOnly?: boolean;
  /** Defaults to `Lax`. */
  sameSite?: "Strict" | "Lax" | "None";
  partitioned?: boolean;
}

const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const jars = new WeakMap<Request, Map<Function, Cookies>>();

/**
 * The request's cookies as fields. Extend it, one field per cookie - its initial value is the default
 * when the request has none:
 *
 * ```ts
 * class Session extends Cookies {
 *   static options = { session: { maxAge: 60 * 60 * 24 * 30 } };
 *   session?: string = undefined;
 *   theme = "light";
 * }
 *
 * Session.get().theme;                  // this request's, or the default
 * Session.set({ session: id });         // Set-Cookie on the reply
 * Session.set({ session: undefined });  // removes it
 * ```
 *
 * One instance per request and class, from `Session.get()` within a call - never `get(Session)`,
 * which would keep one request's cookies. A changed field goes out as `Set-Cookie` when the call replies.
 */
export class Cookies extends Model {
  /** Per-cookie options, by field name. Unset ones are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` over https. */
  static options?: Record<string, CookieOptions>;

  /** This request's instance. */
  static get<T extends Model>(this: Model.Extends<T>): T;

  static get(this: typeof Cookies): Cookies {
    const request = active();

    if (!request) throw new Error(`${this.name}.get() reads the request's cookies - call it within a call.`);

    let jar = jars.get(request);

    if (!jar) jars.set(request, (jar = new Map()));

    let instance = jar.get(this);

    if (!instance) jar.set(this, (instance = open(this, request)));

    return instance;
  }

  /** Sugar for `.get().set(values)`: change this request's cookies. */
  static set<T extends Cookies>(this: Model.Extends<T>, values: Model.Assign<T>): void {
    this.get().set(values);
  }
}

function open(Type: typeof Cookies, request: Request): Cookies {
  const instance = Type.new();
  const sent = read(request.headers.get("cookie") ?? "");
  const fields = Object.keys(instance);
  const given: Record<string, string> = {};

  for (const name of fields) if (Object.hasOwn(sent, name)) given[name] = sent[name];

  for (const name of fields)
    if (!TOKEN.test(name)) throw new Error(`${Type.name}.${name} is not a valid cookie name.`);

  instance.set(given, true);

  const before = instance.get() as Record<string, unknown>;
  const secure = new URL(request.url).protocol === "https:";

  outgoingOf(request).flush.add(() => {
    const after = instance.get() as Record<string, unknown>;

    for (const name of fields) {
      if (Object.is(after[name], before[name])) continue;

      const options = { secure, ...Type.options?.[name] };
      const value = after[name];
      const line = value === undefined || value === null
        ? serialize(name, "", { ...options, maxAge: 0, expires: new Date(0) })
        : serialize(name, String(value), options);

      outgoingOf(request).headers.append("set-cookie", line);
    }
  });

  return instance;
}

function read(header: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const pair of header.split(";")) {
    const at = pair.indexOf("=");

    if (at < 0) continue;

    const name = pair.slice(0, at).trim();

    if (!Object.hasOwn(out, name)) out[name] = decode(pair.slice(at + 1).trim());
  }

  return out;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function serialize(name: string, value: string, options: CookieOptions): string {
  const { maxAge, expires, path = "/", domain, secure, httpOnly = true, sameSite = "Lax", partitioned } = options;
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`];

  if (maxAge !== undefined) parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push("Secure");
  if (httpOnly) parts.push("HttpOnly");
  if (partitioned) parts.push("Partitioned");

  parts.push(`SameSite=${sameSite}`);

  return parts.join("; ");
}
