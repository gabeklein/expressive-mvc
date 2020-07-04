export class ManagedProperty {
  constructor(
    public type: {} | (new (...args: any[]) => any),
    public create: () => {},
    public initial?: {}
  ){}
}

export function setManagedProperty(model: any, initial?: {}) {
  const create = typeof model == "function" ?
    "prototype" in model ?
      () => new model() :
      () => model() :
    typeof model == "object" ?
      () => Object.assign({}, model) :
      null;

  if (typeof model == "object" ||
    "prototype" in model &&
    /^[A-Z]/.test(model.name) === false)
    initial = {};

  if (!create) {
    //todo: detect class attempted to init via stack trace.
    throw new Error(`Managing property ${model} is not possible as it can't be converted to an object.`);
  }

  return new ManagedProperty(model, create, initial);
}
