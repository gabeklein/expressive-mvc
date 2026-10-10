import type { State, set as field } from "@expressive/mvc";

export function runtime(Base: typeof State, set: typeof field) {
  const classes = new Map<string, ErrorConstructor>();
  const versions = new WeakMap<State, string>();

  function define(id: string, name: string): ErrorConstructor {
    // a computed key gives the anonymous class its name
    const named = { [name]: class extends Error {} };
    const Type = named[name] as ErrorConstructor;

    Type.prototype.name = name;
    classes.set(id, Type);

    return Type;
  }

  function pathOf(pattern: string[], name: string): string {
    const at = location.pathname.split("/").filter(Boolean);
    const path = pattern.map((part, i) => {
      if (part === "*") return at.slice(i).join("/");

      const matches = at[i] !== undefined && (part.startsWith(":") || part === at[i]);

      if (!matches)
        throw new Error(`${name}() belongs to /${pattern.join("/")} and cannot be called from ${location.pathname}.`);

      return at[i];
    });

    return "/" + path.join("/");
  }

  async function post(path: string, headers: Record<string, string>, body: unknown): Promise<Response> {
    return fetch(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  }

  async function settle(res: Response): Promise<any> {
    if (res.status === 204 || res.status === 304) return;

    const body = await res.json();

    if (res.ok) return body;

    const { error, message, stack, ...fields } = body;
    const Type = classes.get(error) ?? Error;

    throw Object.assign(new Type(message), fields);
  }

  async function call(pattern: string[], name: string, args: unknown[]): Promise<unknown> {
    return settle(await post(pathOf(pattern, name), { "x-expressive-call": name }, args));
  }

  async function invoke(twin: State, pattern: string[], name: string, args: unknown[]): Promise<unknown> {
    const { value, patch, version } = await settle(await post(pathOf(pattern, name), { "x-expressive-call": name }, args));

    versions.set(twin, version);
    twin.set(patch);

    return value;
  }

  async function attach(twin: State, pattern: string[]): Promise<void> {
    const reply = await settle(await post(pathOf(pattern, "default"), { "x-expressive-get": "default" }, []));

    versions.set(twin, reply.version);
    twin.set(reply.values);
  }

  function twin(pattern: string[], methods: Record<string, string>, fields: string[], name: string): State.Type {
    const named = {
      [name]: class extends Base {
        constructor(...args: any[]) {
          super(...args);

          for (const field of fields) (this as any)[field] = set(undefined, () => {});

          attach(this, pattern);
        }
      },
    };
    const Twin = named[name];

    for (const [method, id] of Object.entries(methods))
      Object.defineProperty(Twin.prototype, method, {
        configurable: true,
        writable: true,
        value(this: State, ...args: unknown[]) {
          return invoke(this, pattern, id, args);
        },
      });

    return Twin;
  }

  return { call, define, twin };
}
