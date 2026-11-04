export interface Hooks {
  headers?(): Record<string, string>;
  reply?(res: Response): Promise<void>;
}

export function client(hooks: Hooks = {}) {
  const classes = new Map<string, ErrorConstructor>();

  function define(id: string, name: string): ErrorConstructor {
    // a computed key gives the anonymous class its name
    const named = { [name]: class extends Error {} };
    const Type = named[name] as ErrorConstructor;

    Type.prototype.name = name;
    classes.set(id, Type);

    return Type;
  }

  function pathOf(pattern: string[], name: string, from = location.pathname): string {
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
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...hooks.headers?.(), ...headers },
      body: JSON.stringify(body),
    });

    await hooks.reply?.(res);

    return settle(res);
  }

  async function settle(res: Response): Promise<any> {
    if (res.status === 304) return;

    const body = await res.json();

    if (res.ok) return body;

    const { error, message, stack, ...fields } = body;
    const Type = classes.get(error) ?? Error;

    throw Object.assign(new Type(message), fields);
  }

  async function call(pattern: string[], name: string, args: unknown[]): Promise<unknown> {
    const reply = await send(pathOf(pattern, name), { "x-expressive-call": name }, args);

    return reply.value;
  }

  return { call, define, pathOf, send };
}
