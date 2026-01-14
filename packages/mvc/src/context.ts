import { addListener } from './control';
import { event, Model, PARENT, uid } from './model';

const LOOKUP = new WeakMap<Model, Context | ((got: Context) => void)[]>();
const KEYS = new Map<symbol | Model.Type, symbol>();

function key(T: Model.Type | symbol, upstream?: boolean): symbol {
  let K = KEYS.get(T);

  if (!K) {
    K = Symbol(typeof T == 'symbol' ? 'get ' + T.description : String(T));
    KEYS.set(T, K);
  }

  return upstream ? key(K) : K;
}

function keys(from: Model.Type, upstream?: boolean) {
  const keys = new Set<symbol>();

  do {
    keys.add(key(from, upstream));
    from = Object.getPrototypeOf(from);
  } while (from !== Model);

  return keys;
}

declare namespace Context {
  type Multiple<T extends Model> = {
    [key: string | number]: Model.Init<T> | T;
  };

  type Accept<T extends Model = Model> = T | Model.Init<T> | Multiple<T>;

  type Expect<T extends Model = Model> = (model: T) => (() => void) | void;
}

interface Context {
  [key: symbol]: Model | Context.Expect | null | undefined;
}

class Context {
  /**
   * Get the context for a specified Model. If a callback is provided, it will be run when
   * the context becomes available.
   */
  static get<T extends Model>(
    on: Model,
    callback: (got: Context) => void
  ): void;

  /**
   * Get the context for a specified Model. Returns undefined if none are found.
   */
  static get<T extends Model>(on: Model): Context | undefined;

  static get({ is }: Model, callback?: (got: Context) => void) {
    const context = LOOKUP.get(is);

    if (context instanceof Context) {
      if (callback) callback(context);
      return context;
    }

    if (callback)
      if (context) context.push(callback);
      else LOOKUP.set(is, [callback]);
  }

  public id = uid();

  protected inputs = {} as Record<string | number, Model | Model.Type>;
  protected cleanup = new Set<() => void>();

  constructor(inputs?: Context.Accept) {
    if (inputs) this.use(inputs);
  }

  /** Find specified type registered to a parent context. Throws if none are found. */
  public get<T extends Model>(Type: Model.Type<T>, require: true): T;

  /** Find specified type registered to a parent context. Returns undefined if none are found. */
  public get<T extends Model>(
    Type: Model.Type<T>,
    require?: boolean
  ): T | undefined;

  /** Run callback when a specified type is registered in context downstream. */
  public get<T extends Model>(
    Type: Model.Type<T>,
    callback: (model: T) => void
  ): () => void;

  public get<T extends Model>(
    Type: Model.Type<T>,
    arg2?: boolean | ((model: T) => void)
  ) {
    if (typeof arg2 == 'function') {
      const k = key(Type, true);
      Object.defineProperty(this, k, {
        value: arg2,
        configurable: true
      });
      return () => {
        delete this[k];
      };
    }

    const result = this[key(Type)];

    if (result === null)
      throw new Error(
        `Did find ${Type} in context, but multiple were defined.`
      );

    if (result) return result as T;

    if (arg2) throw new Error(`Could not find ${Type} in context.`);
  }

  /**
   * Adds a Model to this context.
   */
  protected add<T extends Model>(input: T | Model.Init<T>, implicit?: boolean) {
    const cleanup = new Set<() => void>();
    let T: Model.Type<T>;
    let I: T;

    if (typeof input == 'function') {
      T = input;
      I = new input() as T;
    } else {
      T = input.constructor as Model.Type<T>;
      I = input;
    }

    keys(T, true).forEach((K) => {
      const expects = this[K] as Context.Expect | undefined;

      if (expects)
        addListener(I, (event) => {
          if (event === true) {
            const cb = expects(I);
            if (cb) cleanup.add(cb);
          }

          return null;
        });
    });

    keys(T).forEach((K) => {
      const value = this.hasOwnProperty(K) ? null : I;

      if (value || (this[K] !== I && !implicit))
        Object.defineProperty(this, K, {
          configurable: true,
          value
        });
    });

    this.cleanup.add(() => {
      cleanup.forEach((cb) => cb());
      if (I !== input) event(I, null);
    });

    const waiting = LOOKUP.get(I);

    if (waiting instanceof Array) waiting.forEach((cb) => cb(this));

    LOOKUP.set(I, this);

    return I;
  }

  /**
   * Register one or more Models to this context.
   *
   * Context will add or remove Models as needed to keep with provided input.
   *
   * @param inputs Model, Model class, or map of Models / Model classes to register.
   * @param forEach Optional callback to run for each Model registered.
   */
  public use<T extends Model>(
    inputs: Context.Accept<T>,
    forEach?: Context.Expect<T>
  ) {
    const init = new Map<Model, boolean>();

    if (typeof inputs == 'function' || inputs instanceof Model)
      inputs = { [0]: inputs };

    for (const [K, V] of Object.entries(inputs)) {
      if (!(Model.is(V) || V instanceof Model))
        throw new Error(
          `Context may only include instance or class \`extends Model\` but got ${
            K == '0' || K == String(V) ? V : `${V} (as '${K}')`
          }.`
        );

      const exists = this.inputs[K];

      if (!exists) {
        init.set(this.add(V), true);
      }
      // Context must force-reset because inputs are no longer safe,
      // however probably should do that on a per-model basis.
      else if (exists !== V) {
        this.pop();
        this.use(inputs);
        this.id = uid();
        return;
      }
    }

    for (const [model, explicit] of init) {
      model.set();

      if (explicit && forEach) forEach(model as T);

      for (const [_key, value] of model)
        if (PARENT.get(value as Model) === model) {
          this.add(value as Model, true);
          init.set(value as Model, false);
        }
    }

    this.inputs = inputs;
  }

  /**
   * Create a child context, optionally registering one or more Models to it.
   *
   * @param inputs Model, Model class, or map of Models / Model classes to register.
   */
  public push(inputs?: Context.Accept) {
    const next = Object.create(this) as this;

    this.cleanup = new Set([() => next.pop(), ...this.cleanup]);

    next.inputs = {};
    next.cleanup = new Set();

    if (inputs) next.use(inputs);

    return next;
  }

  /**
   * Remove all Models from this context.
   *
   * Will also run any cleanup callbacks registered when Models were added.
   */
  public pop() {
    for (const key of Object.getOwnPropertySymbols(this)) delete this[key];

    this.cleanup.forEach((cb) => cb());
    this.cleanup.clear();
    this.inputs = {};
  }
}

Object.defineProperty(Context.prototype, 'toString', {
  value() {
    return `Context-${this.id}`;
  }
});

export { Context };
