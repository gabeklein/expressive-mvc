type Params<T> = T extends (... args: infer T) => any ? T : never;
type MessageVariable = string | number | boolean | null;

class Issue extends Error {
  // delete the first line of stack trace
  // hides lookup, not relevant to thrown error
  stack?: string = this.stack!.replace(/\n.+/, "");

  /** Emit this error as a warning instead */
  warn = () => console.warn(this.message);
}

function Issues
  <O extends BunchOf<(...args: MessageVariable[]) => string>>
  (register: O){
  
  const Library = {} as any;

  for(const name in register)
    Library[name] = () => 
      new Issue(register[name].apply(null, arguments as any));

  return Library as {
    readonly [P in keyof O]: (...args: Params<O[P]>) => Issue
  };
}

export default Issues({
  NothingInContext: (name) =>
    `Can't subscribe to controller; this accessor can only be used within a Provider keyed for ${name}.`,

  HasPropertyUndefined: (control, property) =>
    `${control}.${property} is marked as required for this render.`,

  CantAttachGlobal: (parent, child) =>
    `Singleton '${parent}' attempted to attach '${child}'. This is not possible because '${child}' is not also a singleton.`,

  AccessNotTracked: (name) => 
    `Can't watch property ${name}, it's not tracked on this instance.`,

  ComputeFailed: (parent, property) =>
    `There was an attempt to access computed property ${parent}.${property} for the first time; however an exception was thrown. Dependant values probably don't exist yet.`,

  ComputedEarly: (property) => 
    `Note: Computed values are usually only calculated after first access, except where accessed implicitly by "on" or "export". Your '${property}' getter may have run earlier than intended because of that.`,

  BadEffectCallback: () =>
    `Callback for property-update may only return a function.`,

  DestroyNotActive: (name) =>
    `${name}.destory() was called on an instance which is not active. This is an antipattern and may caused unexpected behavior.`,

  GlobalExists: (type) =>
    `Shared instance of ${type} already exists! '${type}.use(...)' may only be mounted once at any one time.`,

  GlobalDoesNotExist: (name) =>
    `Tried to access singleton ${name} but one does not exist! Did you forget to initialize? \nCall ${name}.create() before attempting to access, or consider using ${name}.use() here instead.`,

  FocusIsDetatched: () => 
    `Can't do that boss`
});