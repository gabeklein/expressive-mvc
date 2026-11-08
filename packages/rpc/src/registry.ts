import type { Fault } from "./call";

export function registry(known: Record<string, new (message: string) => Error> = {}) {
  const classes = new Map(Object.entries(known));

  function define(id: string, name: string, parent?: string): ErrorConstructor {
    const Base = (parent !== undefined && classes.get(parent)) || Error;
    const named = { [name]: class extends Base {} };
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
