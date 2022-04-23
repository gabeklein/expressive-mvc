import * as Computed from './compute';
import { control, Controller } from './controller';
import { UPDATE } from './dispatch';
import { Subscriber } from './subscriber';
import { createEffect, define, defineLazy, getOwnPropertyNames } from './util';

export const CONTROL = Symbol("CONTROL");
export const WHY = Symbol("UPDATE");
export const LOCAL = Symbol("LOCAL");
export const STATE = Symbol("STATE");

export interface Stateful {
  /** Controller for this instance. */
  [CONTROL]: Controller;

  /** Current subscriber (if present) while used in a live context (e.g. hook or effect). */
  [LOCAL]?: Subscriber;

  /** Current state of this instance. */
  [STATE]?: this;

  /**
   * Last update causing a refresh to subscribers.
   * 
   * If accessed directly, will contain all keys from last push.
   * If within a subscribed function, will contain only keys which explicitly caused a refresh.
   */
  [WHY]?: readonly string[];
};

declare namespace Model {
  type OnUpdate<T, P> = (this: T, value: IfApplicable<T, P>, changed: P) => void;

  type Effect<T> = (this: T, argument: T) => Callback | Promise<any> | void;

  /** Exotic value, actual value is contained. */
  interface Ref<T = any> {
      (next: T): void;
      current: T | null;
  }

  /** Subset of `keyof T` excluding keys defined by base Model */
  type Fields<T, U extends Model = Model> = Exclude<keyof T, keyof U> & string;

  type Events<T, U extends Model = Model> = Extends<Exclude<keyof T, keyof U> & string>;

  /** Object containing data found in T. */
  type Entries<T, U extends Model = Model> = Pick<T, Fields<T, U>>;

  /** Object comperable to data found in T. */
  type Compat<T, U extends Model = Model> = Partial<Entries<T, U>>;

  /** Actual value stored in state. */
  type Value<R> = R extends Ref<infer T> ? T : R;

  /** Values from current state of given controller. */
  type State<T, K extends keyof T = Fields<T, Model>> = {
      [P in K]: Value<T[P]>;
  }

  type Typeof<T, ST, X extends keyof T = Fields<T>> = {
      [Key in X]: T[Key] extends ST ? Key : never;
  }[X];
}

interface Model extends Stateful {
  /**
   * Circular reference to `this` controller.
   * 
   * Useful to obtain full reference where one has already destructured.
   * 
   * ---
   * 
   * **Retrieve root object after destructure:**
   * 
   * ```js
   * const { active, get: instance } = MyModel.use();
   * ```
   * Is equivalent to:
   * ```js
   * const instance = MyModel.use();
   * const { active } = instance;
   * ```
   * ---
   * 
   * **Access values without watch:**
   * 
   * Also useful to "peek" values without indicating you
   * want them watched, via built-in hook.
   * 
   * ```js
   * const { firstName, get } = Hello.use();
   * 
   * return (
   *   <div onClick={() => {
   *      alert(`Hello ${firstName} ${get.lastName}`)
   *   }}>
   *     Hello {firstName}
   *   </div>
   * )
   * ```
   * Here, it would be a waste to trigger an update every time lastName changes (say, due to an input).
   * Using `get.lastName` allows us to obtain the value only when needed.
   */
  get: this;

  /**
  * Circular reference to `this` controller.
  * 
  * Shortcut is mainly to update values, while having destructured already.
  * 
  * ```js
  * const Example = () => {
  *   const { active, set } = MyToggle.use();
  *   
  *   return (
  *    <div onClick={() => set.active = !active}>
  *      Toggle is {active ? "active" : "inactive"}!
  *    </div>
  *   )
  * }
  * ``` 
  */
  set: this;
}

class Model {
  static [CONTROL]: Controller;
  static [WHY]: readonly string[];

  constructor(){
    define(this, CONTROL, new Controller(this));
    define(this, "get", this);
    define(this, "set", this);
  }

  get [STATE]() {
    return this[CONTROL].state as this;
  }

  get [WHY](){
    return UPDATE.get(this);
  }

  on <P = Model.Events<this>> (keys: [], listener: Model.OnUpdate<this, P>, squash?: boolean, once?: boolean): Callback;
  on <P = Model.Events<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  on (keys: [], listener: unknown, squash: boolean, once?: boolean): Callback;

  on <P extends Model.Events<this>> (key: P | P[], listener: Model.OnUpdate<this, P>, squash?: boolean, once?: boolean): Callback;
  on <P extends Model.Events<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  on <P extends Model.Events<this>> (key: P | P[], listener: unknown, squash: boolean, once?: boolean): Callback;

  on <P extends Model.Events<this>> (
    select: P | P[],
    handler: Function,
    squash?: boolean,
    once?: boolean){

    return control(this, control => {
      const keys = 
        typeof select == "string" ? [select] :
        !select.length ? getOwnPropertyNames(control.state) :
        select;

      Computed.ensure(control, keys);

      const callback: RequestCallback = squash
        ? handler.bind(this)
        : frame => frame
          .filter(k => keys.includes(k))
          .forEach(k => handler.call(this, control.state[k], k))

      const trigger: RequestCallback = once
        ? frame => { remove(); callback(frame) }
        : callback;

      const remove = control.addListener(key => {
        if(keys.includes(key))
          return trigger;
      });

      return remove;
    });
  }

  once <P = Model.Events<this>> (keys: [], listener: Model.OnUpdate<this, P>, squash?: false, once?: boolean): Callback;
  once <P = Model.Events<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  once <P = Model.Events<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  once (keys: [], listener: unknown, squash: boolean, once?: boolean): Callback;

  once <P extends Model.Events<this>> (key: P | P[], listener: Model.OnUpdate<this, P>, squash?: false): Callback;
  once <P extends Model.Events<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true): Callback;
  once <P extends Model.Events<this>> (key: P | P[], listener: unknown, squash: boolean): Callback;
  once <P extends Model.Events<this>> (key: P | P[]): Promise<P[]>;

  once <P extends Model.Events<this>> (
    select: P | P[],
    callback?: UpdateCallback<any, any>,
    squash?: boolean){

    if(callback)
      return this.on(select, callback, squash, true);

    return new Promise<P[]>(resolve => {
      this.on(select, resolve, true, true);
    });
  }

  effect(callback: Model.Effect<this>): Callback;
  effect(callback: Model.Effect<this>, select: []): Callback;
  effect(callback: Model.Effect<this>, select: (keyof this)[]): Callback;
  effect(callback: Model.Effect<this>, select?: (keyof this)[]){
    const effect = createEffect(callback);

    return control(this, control => {
      if(!select){
        const sub = new Subscriber(control, () => invoke);
        const invoke = () => {
          const x = sub.proxy;
          effect.call(x, x);
        }

        invoke();

        return sub.commit();
      }

      const invoke = () => {
        effect.call(this.get, this.get);
      }

      invoke();

      if(!select.length){
        control.onDestroy.add(invoke);
        return () => {
          control.onDestroy.delete(invoke);
        }
      }

      return control.addListener(key => {
        if(select.includes(key as keyof this))
          return invoke;
      });
    })
  }

  import <O extends Model.Compat<this>> (source: O, select?: (keyof O)[]){
    if(!select)
      select = getOwnPropertyNames(this) as (keyof O)[];

    for(const key of select)
      if(key in source)
        (this as any)[key] = source[key];
  }

  export(): Model.State<this>;
  export <P extends Model.Fields<this>> (select: P[]): Model.State<this, P>;

  export(subset?: Set<string> | string[]){
    const { state } = control(this);
    const output: BunchOf<any> = {};

    for(const key of subset || getOwnPropertyNames(state))
      output[key] = (state as any)[key];

    return output;
  }

  update(): PromiseLike<readonly string[] | false>;
  update(strict: true): Promise<readonly string[]>;
  update(strict: false): Promise<false>;
  update(strict: boolean): Promise<readonly string[] | false>;

  update(keys: Model.Events<this>): PromiseLike<readonly string[]>;
  update(keys: Model.Events<this>, callMethod: boolean): PromiseLike<readonly string[]>;
  update<T>(keys: Model.Events<this>, argument: T): PromiseLike<readonly string[]>;

  update(arg?: any, tag?: any): any {
    const target = control(this);

    if(typeof arg == "string"){
      target.update(arg);

      if(1 in arguments && arg in this){
        const method = (this as any)[arg];

        if(typeof method == "function")
          if(typeof tag != "boolean")
            method.call(this, tag);
          else if(tag)
            method.call(this);
      }

      arg = undefined;
    }

    return target.requestUpdate(arg);
  }

  /** 
   * Mark this instance for garbage-collection and send `willDestroy` event to all listeners.
   */
  destroy(){
    control(this, control => {
      control.onDestroy.forEach(x => x());
    })
  }

  toString(){
    return this.constructor.name;
  }

  /**
   * Creates a new instance of this controller.
   * 
   * Beyond `new this(...)`, method will activate managed-state.
   * 
   * @param args - arguments sent to constructor
   */
  static create<T extends Class>(
    this: T, ...args: any[]): InstanceOf<T> {

    const instance = 
      new (this as any)(...args);

    control(instance);

    return instance;
  }

  /**
   * Static equivalent of `x instanceof this`.
   * 
   * Will determine if provided class is a subtype of this one. 
   */
  static isTypeof<T extends typeof Model>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" &&
      maybe.prototype instanceof this
    )
  }
}

export { Model }

defineLazy(Model, CONTROL, function(){
  return new Controller(this);
})