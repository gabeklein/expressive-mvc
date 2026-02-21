import {
  listener,
  watch,
  event,
  Observable,
  observing,
  observe,
  pending
} from './observable';
import { State as Type } from './types.d';

const define = Object.defineProperty;

/** Register for all active states via string identifiers (usually unique). */
const ID = new WeakMap<Type, string>();

/** Internal state assigned to states. */
const STATE = new WeakMap<Type, Record<string | number | symbol, unknown>>();

/** External listeners for any given State. */
const NOTIFY = new WeakMap<Type.Extends, Set<Observable.Notify>>();

/** Parent-child relationships. */
const PARENT = new WeakMap<Type, Type | null>();

/** Reference bound instance methods to real ones. */
const METHOD = new WeakMap<any, any>();

/** List of methods defined by a given type. */
const METHODS = new WeakMap<Function, Map<string, (value: any) => void>>();

/** Currently accumulating export. Stores real values of placeholder properties such as ref() or child states. */
let EXPORT: Map<any, any> | undefined;

interface State extends Type, Observable {}

abstract class State {
  is!: this;

  constructor(...args: Type.Args) {
    prepare(this);
    define(this, 'is', { value: this });
    init(this, ...args, (x: this) => x.new && x.new());
  }

  [Observable](callback: Observable.Callback, required?: boolean) {
    return observe(this, callback, required);
  }

  protected new?(): void | (() => void);

  get(
    arg1?: Type.Effect<any> | string | null,
    arg2?: boolean | Type.OnUpdate<any, any>
  ): any {
    const { is } = this;

    if (arg1 === undefined) return values(is);
    if (typeof arg1 == 'function') return effect(is, arg1);
    if (typeof arg2 == 'function') return listener(is, arg2, arg1);
    if (arg1 === null) return Object.isFrozen(STATE.get(is));
    return access(is, arg1, arg2);
  }

  set(
    arg1?: Type.OnEvent<any> | Type.Assign<any> | Type.Event<any> | null,
    arg2?: unknown,
    arg3?: boolean
  ): any {
    const { is } = this;

    if (typeof arg1 == 'function')
      return listener(is, (key) => {
        if (arg2 === key || (arg2 === undefined && typeof key == 'string'))
          return arg1.call(is, key, is);
      });

    if (arg1 && typeof arg1 == 'object') {
      event(is);
      assign(is, arg1, arg2 === true);
    } else if (!arg2) {
      event(is, arg1);
    } else if (arg3) {
      manage(is, arg1 as string | number, arg2);
    } else {
      update(is, arg1 as string | number, arg2);
    }

    return pending(is) as Type.Pending<any>;
  }

  [Symbol.iterator](): Iterator<[string, unknown]> {
    return Object.entries(STATE.get(this.is)!)[Symbol.iterator]();
  }

  static new<T extends Type>(this: Type.Type<T>, ...args: Type.Args<T>): T {
    const instance = new this(...args);
    event(instance);
    return instance;
  }

  static is<T extends Type.Extends>(this: T, maybe: unknown): maybe is T {
    return (
      maybe === this ||
      (typeof maybe == 'function' && maybe.prototype instanceof this)
    );
  }

  static on<T extends Type>(this: Type.Extends<T>, listener: Type.OnEvent<T>) {
    let notify = NOTIFY.get(this);

    if (!notify) NOTIFY.set(this, (notify = new Set()));

    notify.add(listener);

    return () => notify.delete(listener);
  }
}

define(Type.prototype, 'toString', {
  value() {
    return ID.get(this.is);
  }
});

define(Type, 'toString', {
  value() {
    return this.name;
  }
});

function assign(state: State, data: Type.Assign<Type>, silent?: boolean) {
  const methods = METHODS.get(state.constructor)!;

  for (const key in data) {
    const bind = methods.get(key);

    if (bind) bind.call(state, data[key]);
    else if (key in state && key !== 'is') {
      const desc = Object.getOwnPropertyDescriptor(state, key)!;
      const set = desc && (desc.set as (value: any, silent?: boolean) => void);

      if (set) {
        set.call(state, data[key], silent);
      } else {
        (state as any)[key] = data[key];
      }
    }
  }
}

/** Apply instructions and inherited event listeners. Ensure class metadata is ready. */
function prepare(state: State) {
  let T = state.constructor as Type.Extends;

  if (T === Type) throw new Error('Cannot create base State.');

  const chain = [] as Type.Extends[];
  let keys = new Map<string, (value: any) => void>();

  ID.set(state, `${T}-${uid()}`);

  while (T.name) {
    for (const cb of NOTIFY.get(T) || []) {
      listener(state, cb);
    }

    if (T === Type) break;
    else chain.unshift(T);

    T = Object.getPrototypeOf(T);
  }

  for (const type of chain) {
    if (METHODS.has(type)) {
      keys = METHODS.get(type)!;
      continue;
    }

    METHODS.set(type, (keys = new Map(keys)));

    for (const [key, { value }] of Object.entries(
      Object.getOwnPropertyDescriptors(type.prototype)
    )) {
      if (!value || key == 'constructor') continue;

      function bind(this: Type, original?: Function) {
        const { is } = this;

        if (is.hasOwnProperty(key) && !original) return value as Function;

        const fn = original || value;
        const bound = fn.bind(is);

        METHOD.set(bound, fn);
        define(is, key, { value: bound, writable: true });

        return bound;
      }

      keys.set(key, bind);
      define(type.prototype, key, { get: bind, set: bind });
    }
  }
}

/**
 * Apply state arguemnts, run callbacks and observe properties.
 * Accumulate and handle cleanup events.
 **/
function init(state: State, ...args: Type.Args) {
  const store = {} as Record<string | number | symbol, unknown>;

  STATE.set(state, store);

  args = args.flat().filter((arg) => {
    if (typeof arg == 'string') ID.set(state, arg);
    else return true;
  });

  listener(state, () => {
    if (!PARENT.has(state)) PARENT.set(state, null);

    for (const key in state) {
      const desc = Object.getOwnPropertyDescriptor(state, key)!;

      if ('value' in desc) manage(state, key, desc.value, true);
    }

    for (const arg of args) {
      const use =
        typeof arg == 'function'
          ? arg.call(state, state)
          : (arg as Type.Assign<Type>);

      if (use instanceof Promise)
        use.catch((err) => {
          console.error(`Async error in constructor for ${state}:`);
          console.error(err);
        });
      else if (Array.isArray(use)) args.push(...use);
      else if (typeof use == 'function') listener(state, use, null);
      else if (typeof use == 'object') assign(state, use, true);
    }

    listener(
      state,
      () => {
        for (const [_, value] of state)
          if (value instanceof Type && PARENT.get(value) === state)
            value.set(null);

        Object.freeze(store);
      },
      null
    );

    return null;
  });
}

function manage(
  state: State,
  key: string | number,
  value: any,
  silent?: boolean
) {
  const store = STATE.get(state)!;

  function get(this: Type) {
    return observing(this, key, store[key]);
  }

  function set(value: unknown, silent?: boolean) {
    update(state, key, value, silent);
    if (value instanceof Type && !PARENT.has(value)) {
      PARENT.set(value, state);
      event(value);
    }
  }

  define(state, key, { set, get });
  set(value, silent);
}

function effect<T extends Type>(state: T, fn: Type.Effect<T>) {
  const effect: Type.Effect<T> = METHOD.get(fn) || fn;

  return watch(state, (proxy, changed) => {
    const cb = effect.call(proxy, proxy, changed || []);

    if (typeof cb == 'function' || cb === null) return cb;
  });
}

function values<T extends Type>(state: T): Type.Values<T> {
  const values = {} as any;
  let isNotRecursive;

  if (!EXPORT) {
    isNotRecursive = true;
    EXPORT = new Map([[state, values]]);
  }

  for (let [key, value] of state) {
    if (EXPORT.has(value)) value = EXPORT.get(value);
    else if (
      value &&
      typeof value == 'object' &&
      'get' in value &&
      typeof value.get === 'function'
    )
      EXPORT.set(value, (value = value.get()));

    values[key] = value;
  }

  if (isNotRecursive) EXPORT = undefined;

  return Object.freeze(values);
}

function access(state: Type, property: string, required?: boolean) {
  const store = STATE.get(state)!;

  if (property in store || required === false) {
    const value = store[property];

    if (value !== undefined || !required) return value;
  }

  if (METHODS.get(state.constructor)!.has(property))
    return METHOD.get((state as any)[property]);

  const error = new Error(`${state}.${property} is not yet available.`);
  const promise = new Promise<any>((resolve, reject) => {
    listener(state, (key) => {
      if (key === property) {
        resolve(store[key]);
        return null;
      }

      if (key === null) {
        reject(new Error(`${state} is destroyed.`));
      }
    });
  });

  throw Object.assign(promise, {
    toString: () => String(error),
    name: 'Suspense',
    message: error.message,
    stack: error.stack
  });
}

function update<T>(
  state: State,
  key: string | number | symbol,
  value: T,
  arg?: boolean | Type.Setter<T>
) {
  const store = STATE.get(state)!;

  if (Object.isFrozen(store))
    throw new Error(
      `Tried to update ${state}.${String(key)} but state is destroyed.`
    );

  const previous = store[key] as T;

  if (typeof arg == 'function') {
    const out = arg.call(state, value, previous);

    if (out === false) return false;

    if (typeof out == 'function') value = out();
  }

  if (value === previous && key in store) return;

  store[key] = value;

  if (arg !== true) event(state, key);

  return true;
}

/** Random alphanumberic of length 6; always starts with a letter. */
function uid() {
  return (0.278 + Math.random() * 0.722)
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

export { event, METHOD, PARENT, STATE, uid, access, update, State };
