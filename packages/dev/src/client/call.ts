export function runtime() {
  const classes = new Map<string, ErrorConstructor>();

  function define(id: string, name: string): ErrorConstructor {
    const Type = { [name]: class extends Error {} }[name] as ErrorConstructor;
    Type.prototype.name = name;
    classes.set(id, Type);
    return Type;
  }

  async function call(pattern: string[], name: string, args: unknown[]): Promise<unknown> {
    const at = location.pathname.split("/").filter(Boolean);
    const path = pattern.map((part, i) => {
      if (part === "*") return at.slice(i).join("/");
      if (at[i] === undefined || part[0] !== ":" && part !== at[i])
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

    throw Object.assign(new (classes.get(error) ?? Error)(message), fields);
  }

  return { call, define };
}
