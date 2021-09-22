import Lifecycle from './lifecycle';
import { Select, Selector } from './selector';
import { Class, InstanceOf, Key } from './types';

interface PropertyDescriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: T;
    writable?: boolean;
    get?(): T;
    set?(v: T): void;
}

type Argument<T> = T extends (arg: infer U) => any ? U : never;

type Thenable<T> = {
    then(onFulfilled: (arg: T) => void): void;
}

export namespace Model {
    /** Exotic value, actual value is contained. */
    interface Ref<T = any> {
        (next: T): void;
        current: T | null;
    }

    type GetFunction<T> = (within?: Subscriber) => T;

    /**
     * Property initializer, will run upon instance creation.
     * Optional returned callback will run when once upon first access.
    */
    type Instruction<T> = (this: Controller, key: string, thisArg: Controller) =>
        void | GetFunction<T> | PropertyDescriptor<T>;

    /** Shallow replacement given all entries of Model */
    type Overlay<T, R> = { [K in keyof Entries<T>]: R };

    /** Subset of `keyof T` excluding keys defined by base Model */
    type Fields<T, E = Model> = Exclude<keyof T, keyof E>;

    /** Object containing data found in T. */
    type Entries<T, E = Model> = Pick<T, Fields<T, E>>;

    /** Actual value stored in state. */
    type Value<R> = R extends Ref<infer T> ? T : R;

    /** Values from current state of given controller. */
    type State<T, K extends keyof T = Fields<T, Model>> = {
        [P in K]: Value<T[P]>;
    }

    /** Object comperable to data which may be found in T. */
    type Data<T, E = Model> = Partial<Entries<T, E>>;

    /** Subset of `keyof T` excluding keys defined by base Model, except lifecycle. */
    type Events<T> = Omit<T, Exclude<keyof Model, keyof Lifecycle>>;

    type EventsCompat<T> = keyof T | keyof Lifecycle;

    /**
     * Field selector which includes Model-Lifecycle events.
     * Can select for any tracked-property on a specified controller.
     * 
     * Function `SelectEvent<T>` is a preferred alterative to string `keyof T`.
     * 
     * ---
     * 
     * ```js
     * Model.on(x => x.foo.bar.didMountComponent, cb)
     * ```
     * is equivalent to, while also more robust than:
     * ```js
     * Model.on(["foo", "bar", "didMountComponent"], cb)
     * ```
     */
    type SelectEvents<T> = Selector.Function<Events<T>>;

    /**
     * Field selector function you provide. Argument is a representation of controller specified.
     * *When used as an argument*, return a chain of properties desired for a given operation.
     * 
     * Allows for refactor safe selection of properties belonging to a controller. 
     * Using selectors is generally recommended to prevent unexpected behavior to be caused by bundling of your code.
     * 
     * ---
     * 
     * **Selector used to update specific properties:**
     * 
     * ```js
     * Model.update(x => x.foo.bar.baz)
     * ```
     * 
     * is equivalent to, while more robust than:
     * 
     * ```js
     * Model.update(["foo", "bar", "baz"])
     * ```
     */
    type SelectFields<T> = Selector.Function<Omit<T, keyof Model>>;

    type SelectField<T> = (arg: Omit<T, keyof Model>) => any;

    type SelectFieldKey<T> = Select.Key<Fields<T>>;

    type Typeof<T, ST, X extends keyof T = Exclude<keyof T, keyof Model>> = {
        [Key in X]: T[Key] extends ST ? Key : never;
    }[X];

    type SelectTypeof<T, ST> = Select.Key<Typeof<T, ST>>;

    type HandleValue = (value: any) => boolean | void;

    export class Controller {
        state: BunchOf<any>;
        subject: {};

        /** Add property to managed state. */
        manage(key: string, initial: any, effect?: HandleValue): void;

        select(using?: Query): string[];

        setter(key: string, effect?: HandleValue): (value: any) => boolean | void;

        addListener(batch: BunchOf<RequestCallback>): Callback;

        update(key: string, value?: any): void;

        include(cb: RequestCallback): void;
    }

    export class Subscriber {
        proxy: any;
        source: any;
        parent: Controller;
        active: boolean;
        follows: BunchOf<Callback>;
        dependant: Set<{
            commit(): void;
            release(): void;
        }>;

        follow(key: string, cb?: Callback | undefined): void;
        commit(): Callback;
        release(): Callback;
        onUpdate(): void;
    }
}

declare const CONTROL: unique symbol;
declare const LOCAL: unique symbol;
declare const STATE: unique symbol;

export abstract class State {
    /** Controller for this instance. */
    [CONTROL]: Model.Controller;

    /** Current state of this instance. */
    [STATE]?: Model.State<this>;

    /** Current subscriber (if present) while used in a live context (e.g. hook or effect). */
    [LOCAL]?: Model.Subscriber;

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
     * Useful mnemonic to update values on a controller from within a component.
     * 
     * ---
     * 
     * ```js
     * const { active, set } = MyToggle.use();
     * 
     * return (
     *  <div onClick={() => set.active = !active}>
     *    Toggle is {active ? "active" : "inactive"}!
     *  </div>
     * )
     * ``` 
     */
    set: this;

    import <O extends Model.Data<this>> (via: O, select?: string[] | Model.SelectFields<this>): void;

    export(): Model.State<this>;
    export <P extends Model.Fields<this>> (select: P[]): Model.State<this, P>;
    export <S extends Model.SelectFields<this>> (select: S): Model.State<this, Selector.From<S>>;

    update(): PromiseLike<string[] | false>;
    update(strict: true): Promise<string[]>;
    update(strict: false): Promise<false>;
    update(strict: boolean): Promise<string[] | false>;

    update(keys: Model.Fields<this>): Thenable<string[]>;
    update(keys: Model.SelectFieldKey<this>): Thenable<string[]>;

    update(keys: Model.Typeof<this, () => void>, callMethod: boolean): Thenable<string[]>;
    update(keys: Model.SelectTypeof<this, () => void>, callMethod: boolean): Thenable<string[]>;

    update<T>(keys: Model.Typeof<this, (arg: T) => void>, argument: T): Thenable<string[]>;
    update<T>(keys: Model.SelectTypeof<this, (arg: T) => void>, argument: T): Thenable<string[]>;

    /** 
     * Mark this instance for garbage-collection and send `willDestroy` event to all listeners.
     * 
     * Implemented by class in-use, see `Model.willDestroy`.
     */
    destroy(): void;

    /**
     * Callback for when a controller is fully activated and about to be in use.
     * 
     * Invoke after initial state has been locked, and instance is now aware of what values should be tracked.
     */
    didCreate?(): void;

    /**
     * Callback for when a controller is about to expire.
     */
    willDestroy?(): void;

    /** Attaches this controller to a component. */
    tap(): this;

    /** Tracks specific key of this controller within a component. */
    tap <K extends Model.Fields<this>> (key: K, expect?: boolean): this[K];
    tap <K extends Model.Fields<this>> (key: K, expect: true): Exclude<this[K], undefined>;

    tap <K extends Model.SelectField<this>> (key: K, expect?: boolean): ReturnType<K>;
    tap <K extends Model.SelectField<this>> (key: K, expect: true): Exclude<ReturnType<K>, undefined>;

    /** Use symbol to access controller of a model. */
    static CONTROL: typeof CONTROL;

    /** Use symbol to access current state of a model. */
    static STATE: typeof STATE;

    /** Use symbol to access current subscriber of a model in a live context (e.g. hook or effect). */
    static LOCAL: typeof LOCAL;

    /**
     * Creates a new instance of this controller.
     * 
     * Beyond `new this(...)`, method will activate managed-state.
     * 
     * @param args - arguments sent to constructor
     */
    static create <T extends Class> (this: T, ...args: ConstructorParameters<T>): InstanceOf<T>;

    /**
     * **React Hook** - Spawn and maintain a controller from within a component.
     * 
     * Differs from `use()` in lacking subscription and lifecycle events.
     * Much more efficient if you don't need hook-based features.
     * 
     * @param args - Arguments passed to constructor of `this`
     * @param callback - Run after creation of instance.
     */
    static new <T extends Class> (this: T, args?: ConstructorParameters<T>, callback?: (instance: InstanceOf<T>) => void): InstanceOf<T>;

    /**
     * **React Hook** - Create and attach an instance of this controller a react component.
     * 
     * Note: Model will be destroyed when ambient component unmounts!
     * 
     * @param args - Arguments passed to constructor of `this`
     * @param callback - Run after creation of instance.
     */
    static use <T extends Class> (this: T, args?: ConstructorParameters<T>, callback?: (instance: InstanceOf<T>) => void): InstanceOf<T>;

    /**
     * **React Hook** - Similar to `use`, will instanciate a controller bound to ambient component.
     * Accepts an object of values which are injected into controller prior to activation.
     * 
     * @param data - Data to be applied to controller upon creation.
     */
    static uses <T extends Class, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D, only?: (keyof D)[]): I;

    /**
     * **React Hook** - Similar to `uses`, will instanciate a controller includive of given data.
     * This controller however will remain syncronized with input data at all times.
     * Changes to input data between renders are captured and included in state/event stream.
     * 
     * @param data - Data to be observed by controller.
     */
    static using <T extends Class, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D, only?: (keyof D)[]): I;

    /**
     * **React Hook** - Locate most relevant instance of this type in context.
     */
    static find <T extends Class>(this: T): InstanceOf<T>;

    /**
     * **React Hook** - Fetch most instance of this controller from context, if it exists.
     * 
     * @param expect - If true, will throw where controller cannot be found. Otherwise, may return undefined.
     */
    static get <T extends Class> (this: T, expect?: boolean): InstanceOf<T> | undefined;

    /**
     * **React Hook** - Fetch most instance of this controller from context.
     * 
     * @param expect - Will throw if controller cannot be found.
     */
    static get <T extends Class> (this: T, expect: true): InstanceOf<T>;

    /**
     * **React Hook** - Fetch specific value from instance of this controller in context.
     */
    static get <T extends Class, I extends InstanceOf<T>, K extends Model.Fields<I>> (this: T, key: K): I[K];

    /**
     * **React Hook** - Fetch specific value from instance of this controller in context.
     */
    static get <T extends Class, I extends InstanceOf<T>, K extends Model.SelectField<I>> (this: T, key?: K): ReturnType<K>;
    
    /** 
     * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
     */
    static tap <T extends Class> (this: T): InstanceOf<T>;

    /** 
     * **React Hook** - Fetch and subscribe to a value on applicable instance within ambient component.
     */
    static tap <T extends Class, I extends InstanceOf<T>, K extends Model.Fields<I>> (this: T, key: K, expect?: boolean): I[K];
    static tap <T extends Class, I extends InstanceOf<T>, K extends Model.SelectField<I>> (this: T, key?: K, expect?: boolean): ReturnType<K>;

    /** 
     * **React Hook** - Fetch and subscribe to a value on applicable instance within ambient component.
     * 
     * **(In Expect Mode)** - Will throw of value is undefined.
     * This makes return type non-nullable and convenient to use without optional chaining.
     */
    static tap <T extends Class, I extends InstanceOf<T>, K extends Model.Fields<I>> (this: T, key: K, expect: true): Exclude<I[K], undefined>;
    static tap <T extends Class, I extends InstanceOf<T>, K extends Model.SelectField<I>> (this: T, key: K, expect: true): Exclude<ReturnType<K>, undefined>;

    /**
     * Static equivalent of `x instanceof this`.
     * 
     * Will determine if provided class is a subtype of this one. 
     */
    static isTypeof <T extends Class>(this: T, subject: any): subject is T;
}

export interface Model extends Lifecycle {}
export abstract class Model extends State {
    // Keyed
    on <S extends Model.SelectEvents<this>> (via: S, cb: Selector.Callback<S, this>, squash?: false, once?: boolean): Callback;
    on <P extends Model.EventsCompat<this>> (key: P | P[], listener: UpdateCallback<this, P>, squash?: false, once?: boolean): Callback;
    // Squash
    on <S extends Model.SelectEvents<this>> (via: S, cb: (keys: Selector.From<S>[]) => void, squash: true, once?: boolean): Callback;
    on <P extends Model.EventsCompat<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
    // Unknown
    on <S extends Model.SelectEvents<this>> (via: S, cb: unknown, squash: boolean, once?: boolean): Callback;
    on <P extends Model.EventsCompat<this>> (key: P | P[], listener: unknown, squash: boolean, once?: boolean): Callback;

    // Keyed
    once <S extends Model.SelectEvents<this>> (via: S, cb: Selector.Callback<S, this>, squash?: false): Callback;
    once <P extends Model.EventsCompat<this>> (key: P | P[], listener: UpdateCallback<this, P>, squash?: false): Callback;
    // Squash
    once <S extends Model.SelectEvents<this>> (via: S, cb: (keys: Selector.From<S>[]) => void, squash: true): Callback;
    once <P extends Model.EventsCompat<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true): Callback;
    // Promise
    once <S extends Model.SelectEvents<this>> (via: S): Promise<Selector.From<S>[]>;
    once <P extends Model.EventsCompat<this>> (key: P | P[]): Promise<P[]>;
    // Unknown
    once <S extends Model.SelectEvents<this>> (via: S, cb: unknown, squash: boolean): Callback;
    once <P extends Model.EventsCompat<this>> (key: P | P[], listener: unknown, squash: boolean): Callback;

    effect(callback: (this: this, state: this) => void, select?: Model.SelectFields<this>): Callback;
    effect(callback: (this: this, state: this) => void, select?: (keyof this)[]): Callback;

    /**
     * **React Hook** - Attach to instance of this controller within ambient component.
     * 
     * This method will fire lifecycle events on given controller.
     * 
     * @param id - Argument passed to controller-lifecycle methods. Use to identify the consumer.
     */
    tag(id?: Key): this;

     /**
      * **React Hook** - Attach to instance of this controller within ambient component.
      * 
      * This method will fire lifecycle events on given controller.
      * 
      * @param idFactory - Will be invoked with fetched instance. Use this to register a tag as-needed.
      */
    tag(idFactory: (idFactory: this) => Key | void): this;


    /**
     * **React Hook** - Attach to instance of this controller within ambient component.
     * 
     * This method will fire lifecycle events on given controller.
     * 
     * @param id - Argument passed to controller-lifecycle methods. Use to identify the consumer.
     */
    static tag <T extends Class, I extends InstanceOf<T>> (this: T, id?: Key): I;

    /**
     * **React Hook** - Attach to instance of this controller within ambient component.
     * 
     * This method will fire lifecycle events on given controller.
     * 
     * @param idFactory - Will be invoked with fetched instance. Use this to register a tag as-needed.
     */
    static tag <T extends Class, I extends InstanceOf<T>> (this: T, idFactory: (on: I) => Key | void): I;

    /** 
     * **React Hook** - Fetch and subscribe to *class itself* within a component.
     * 
     * This allows you to do pretty meta stuff.
     * 
     * Documentation TBD.
     */
    static meta <T extends Class>(this: T): T;

    /** 
     * **React Hook** - Fetch and subscribe to value defined on class itself using selectors.
     * 
     * Documentation TBD.
     */
    static meta <T extends Class, K extends Model.SelectField<T>> (this: T, key?: K): ReturnType<K>;
}

export class Singleton extends Model {
    /** Current instance of this controller accessable anywhere. */
    static current?: Singleton;

    /** Destroy current instance of Singleton, if it exists. */
    static reset(): void;
}