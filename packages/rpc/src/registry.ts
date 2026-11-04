import type { Fault } from "./call";

export function registry(known: Record<string, ErrorConstructor> = {}) {
  const classes = new Map(Object.entries(known));

  function define(id: string, name: string): ErrorConstructor {
    const named = { [name]: class extends Error {} };
    const Type = named[name] as ErrorConstructor;

    Type.prototype.name = name;
    classes.set(id, Type);

    return Type;
  }

  function rebuild({ error, message, stack, ...fields }: Fault): Error {
    const Type = classes.get(error!) ?? Error;

    return Object.assign(new Type(message), fields);
  }

  return { define, rebuild };
}
