import Dispatch from './dispatch';
import Lifecycle from './lifecycle';
import { Selector } from './selector';
import { Class, InstanceOf, Key } from './types';

interface PropertyDescriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: T;
    writable?: boolean;
    get?(): T;
    set?(v: T): void;
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
    type Instruction<T> = (this: Controller, key: string) =>
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

    export class Controller {
        state: BunchOf<any>;

        /**
         * Place a given key's property under management.
         * 
         * Note: If property is occupied by an instruction, it will be run.
         */
        add(key: string): void;

        /** Add property to managed state. */
        manage(key: string, initial: any, effect?: EffectCallback<any, any>): void;

        select(using?: Query): string[];

        sets(key: string, effect?: EffectCallback<any, any>): (value: any) => void;

        watch(target: string | Iterable<string> | Query, handler: Function, squash?: boolean, once?: boolean): Callback;

        addListener(batch: BunchOf<RequestCallback>): Callback;

        update(key: string): void;

        include(cb: RequestCallback): void;
    }

    type Listener = {
        commit(): void;
        release(): void;
    }
      
    export class Subscriber {
        proxy: any;
        active: boolean;
        follows: BunchOf<Callback>;
        dependant: Set<Listener>;
        parent: Controller;

        follow(key: string, cb?: Callback | undefined): void;
        commit(): Callback;
        release(): Callback;
        onUpdate(): void;
    }
}

declare const CONTROL: unique symbol;
declare const LOCAL: unique symbol;
declare const STATE: unique symbol;

export interface Model extends Dispatch, Lifecycle {}

export abstract class Model {
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

    /** Controller of this instance. */
    [CONTROL]: Model.Controller;

    /** Current state of this instance. */
    [STATE]?: Model.State<this>;

    /** Current subscriber (if present) while used in a watch context (i.e. hook). */
    [LOCAL]?: Model.Subscriber;

    /** Key for controller of model instance. */
    static CONTROL: typeof CONTROL;

    /** Key for current state of model instance. */
    static STATE: typeof STATE;

    /** Key for subscriber of current instance in a watched context (i.e. hook). */
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
     */
    static new <T extends Class> (this: T, ...args: ConstructorParameters<T>): InstanceOf<T>;

    /**
     * **React Hook** - Create and attach an instance of this controller a react component.
     * 
     * Note: Model will be destroyed when ambient component unmounts!
     * 
     * @param args - Arguments passed to constructor of `this`
     */
    static use <T extends Class> (this: T, ...args: ConstructorParameters<T>): InstanceOf<T>;

    /**
     * **React Hook** - Similar to `use`, will instanciate a controller bound to ambient component.
     * Accepts an object of values which are injected into controller prior to activation.
     * 
     * @param data - Data to be applied to controller upon creation.
     */
    static uses <T extends Class, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D): I;

    /**
     * **React Hook** - Similar to `uses`, will instanciate a controller includive of given data.
     * This controller however will remain syncronized with input data at all times.
     * Changes to input data between renders are captured and included in state/event stream.
     * 
     * @param data - Data to be observed by controller.
     */
    static using <T extends Class, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D): I;

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

    /**
     * **React Hook** - Locate most relevant instance of this type in context.
     */
    static find <T extends Class>(this: T): InstanceOf<T>;

    /**
     * Static equivalent of `x instanceof this`.
     * 
     * Will determine if provided class is a subtype of this one. 
     */
    static isTypeof <T extends Class>(this: T, subject: any): subject is T;

    /** 
     * Retreives parent inherited by this class, unless it is base `Model`.
     */
    static inherits: typeof Model | undefined;
}

export class Singleton extends Model {
    /** Current instance of this controller accessable anywhere. */
    static current?: Singleton;

    /** Destroy current instance of Singleton, if it exists. */
    static reset(): void;
}