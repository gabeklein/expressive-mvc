import type { State, def as instruction } from "@expressive/mvc";

export function runtime(Base: typeof State, def: typeof instruction) {
  const classes = new Map<string, ErrorConstructor>();
  const versions = new WeakMap<State, string>();
  const pending = new WeakMap<State, State.Apply[]>();
  let syncing = false;

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

  function served(): unknown {
    return def((key, twin) => {
      const config: State.Apply = {
        get: true,
        set() {
          if (!syncing) throw new Error(`${twin}.${key} is read-only - change it through a method.`);
        },
      };

      pending.get(twin)!.push(config);

      return config;
    });
  }

  function sync(twin: State, fields: string[], values: Record<string, unknown>, version: string): void {
    const [generation, counter] = version.split(":");
    const [held, at] = versions.get(twin)?.split(":") ?? [];
    const configs = held === generation ? undefined : pending.get(twin);

    if (!configs && Number(counter) < Number(at)) return;
    if (configs) values = Object.fromEntries(fields.map(field => [field, values[field]]));

    versions.set(twin, version);
    syncing = true;

    try {
      twin.set(values);
    } finally {
      syncing = false;
    }

    configs?.splice(0).forEach(config => (config.get = false));
  }

  function since(twin: State): Record<string, string> {
    const version = versions.get(twin);
    return version ? { "if-none-match": version } : {};
  }

  async function invoke(twin: State, pattern: string[], fields: string[], name: string, args: unknown[]): Promise<unknown> {
    const { value, patch, version } = await settle(await post(pathOf(pattern, name), { "x-expressive-call": name, ...since(twin) }, args));

    sync(twin, fields, patch, version);

    return value;
  }

  async function attach(twin: State, pattern: string[], fields: string[]): Promise<void> {
    const { values, version } = await settle(await post(pathOf(pattern, "default"), { "x-expressive-get": "default" }, []));

    sync(twin, fields, values, version);
  }

  function twin(pattern: string[], methods: Record<string, string>, fields: string[], name: string): State.Type {
    const named = {
      [name]: class extends Base {
        constructor(...args: any[]) {
          super(...args);

          pending.set(this, []);

          for (const field of fields) (this as any)[field] = served();

          attach(this, pattern, fields);
        }
      },
    };
    const Twin = named[name];

    for (const [method, id] of Object.entries(methods))
      Object.defineProperty(Twin.prototype, method, {
        configurable: true,
        writable: true,
        value(this: State, ...args: unknown[]) {
          return invoke(this, pattern, fields, id, args);
        },
      });

    return Twin;
  }

  return { call, define, twin };
}
