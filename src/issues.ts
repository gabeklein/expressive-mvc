type MessageVariable = string | number | boolean | null;
type Messages = BunchOf<(...args: MessageVariable[]) => string>;
type Params<T> = T extends (... args: infer T) => any ? T : never;
type Issues<M extends Messages> = {
  readonly [P in keyof M]: (...args: Params<M[P]>) => Issue;
}

class Issue extends Error {
  // delete the first line of stack trace,
  // hiding lookup step, not relevant to error.
  stack?: string = this.stack!.replace(/\n.+/, "");

  /** Emit this issue as a warning instead. */
  warn = () => console.warn(this.message);
}

function Issues<O extends Messages>(register: O): Issues<O> {
  const Library = {} as any;

  for(const name in register)
    Library[name] = (...args: MessageVariable[]) => 
      new Issue(register[name].apply(null, args));

  return Library;
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

  AccessEvent: (parent, name) =>
    `Can't update ${parent}.${name}; it is only an event.`,

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
    `Tried to access singleton ${name} but one does not exist! Did you forget to initialize?\nCall ${name}.create() before attempting to access, or consider using ${name}.use() here instead.`,

  FocusIsDetatched: () => 
    `Can't do that boss`,

  BadHOCArgument: () =>
    `Argument for hoc() is not a component.`,

  BindRefNotFound: (parent, property) =>
    `Ref not found, trying to bind ${parent}.${property} to custom HOC.`,

  StrictUpdate: () => 
    `Strict requestUpdate() did not find pending updates.`,

  NoObserver: (className) =>
    `No observer exists for this instance of ${className}. Is it a Controller?`,

  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got} but must be instanceof ${expects}`
});