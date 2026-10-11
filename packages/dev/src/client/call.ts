import type { State } from "@expressive/mvc";

export function runtime(Base: typeof State) {
  const classes = new Map<string, ErrorConstructor>();

  function define(id: string, name: string): ErrorConstructor {
    // a computed key gives the anonymous class its name
    const named = { [name]: class extends Error {} };
    const Type = named[name] as ErrorConstructor;

    Type.prototype.name = name;
    classes.set(id, Type);

    return Type;
  }

  async function call(pattern: string[], name: string, args: unknown[]): Promise<unknown> {
    const at = location.pathname.split("/").filter(Boolean);
    const path = pattern.map((part, i) => {
      if (part === "*") return at.slice(i).join("/");

      const matches = at[i] !== undefined && (part.startsWith(":") || part === at[i]);

      if (!matches)
        throw new Error(`${name}() belongs to /${pattern.join("/")} and cannot be called from ${location.pathname}.`);

      return at[i];
    });

    const res = await fetch("/" + path.join("/"), {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-call": name },
      body: JSON.stringify(args),
    });

    if (res.status === 204) return;

    const body = await res.json();

    if (res.ok) return body;

    const { error, message, stack, ...fields } = body;
    const Type = classes.get(error) ?? Error;

    throw Object.assign(new Type(message), fields);
  }

  function twin(pattern: string[], methods: Record<string, string>, name: string): State.Type {
    const named = { [name]: class extends Base {} };
    const Twin = named[name];

    for (const [method, id] of Object.entries(methods))
      Object.defineProperty(Twin.prototype, method, {
        configurable: true,
        writable: true,
        value: (...args: unknown[]) => call(pattern, id, args),
      });

    return Twin;
  }

  return { call, define, twin };
}
