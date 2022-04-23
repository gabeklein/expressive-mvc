export type Async<T = any> = (this: T, ...args: any[]) => Promise<any>;
export type BunchOf<T> = { [key: string]: T };
export type InstanceOf<T> = T extends { prototype: infer U } ? U : never;
export type Class = new (...args: any[]) => any;

type Callback = () => void;
type Argument<T> = T extends (arg: infer U) => any ? U : never;
type IfApplicable<T extends {}, K> = K extends keyof T ? T[K] : undefined;
type Including<T> = T | (string & Record<never, never>);

type Thenable<T> = {
    then(onFulfilled: (arg: T) => void): void;
}

export namespace Model {
    /** Exotic value, actual value is contained. */
    interface Ref<T = any> {
        (next: T): void;
        current: T | null;
    }

    type UpdateCallback<T, P> = (this: T, value: IfApplicable<T, P>, changed: P) => void;

    type EffectCallback<T> = (this: T, argument: T) => Callback | Promise<any> | void;

    /**
     * Property initializer, will run upon instance creation.
     * Optional returned callback will run when once upon first access.
    */
    type Instruction<T, M> = (this: Controller, key: string, thisArg: Controller) =>
        void | Instruction.Getter<T> | Instruction.Descriptor<T>;

    namespace Instruction {
        interface Descriptor<T> {
            configurable?: boolean;
            enumerable?: boolean;
            value?: T;
            writable?: boolean;
            get?(current: T | undefined, within?: Subscriber): T;
            set?(value: T, state: any): boolean | void;
        }
    
        type Getter<T> = (state: T | undefined, within?: Subscriber) => T;
    }

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

    /** Object comperable to data found in T. */
    type Compat<T, Exclude = Model> = Partial<Entries<T, Exclude>>;

    /** Subset of `keyof T` excluding keys defined by base Model. */
    type Events<T> = Omit<T, keyof Model>;

    type EventsCompat<T> = Including<keyof T>;

    type Typeof<T, ST, X extends keyof T = Exclude<keyof T, keyof Model>> = {
        [Key in X]: T[Key] extends ST ? Key : never;
    }[X];

    export namespace Controller {
        type RequestCallback = (keys: readonly string[]) => void;

        type OnEvent = (key: string, source: Controller) =>
            RequestCallback | undefined;

        type OnValue = <T>(this: T, value: any, state: T) => boolean | void;
    }

    export class Controller {
        state: BunchOf<any>;
        subject: {};
        waiting: Set<Controller.RequestCallback>;
        frame: Set<string>;

        start(): void;

        manage(key: string, effect?: Controller.OnValue): void;

        ref(key: string, effect?: Controller.OnValue): (value: any) => boolean | void;

        addListener(listener: Controller.OnEvent): Callback;

        update(key: string, value?: any): void;

        requestUpdate(): PromiseLike<readonly string[] | false>;
        requestUpdate(strict: true): Promise<readonly string[]>;
        requestUpdate(strict: false): Promise<false>;
        requestUpdate(strict: boolean): Promise<readonly string[] | false>;
        requestUpdate(callback: Controller.RequestCallback): void;
    }

    export class Subscriber {
        proxy: any;
        source: any;
        parent: Controller;
        active: boolean;
        listen: Controller.OnEvent;
        dependant: Set<{
            commit(): void;
            release(): void;
        }>;

        follow(key: string, cb?: Controller.RequestCallback | undefined): void;
        commit(): Callback;
        release(): Callback;
        onUpdate(): void;
    }
}

declare const CONTROL: unique symbol;
declare const WHY: unique symbol;
declare const LOCAL: unique symbol;
declare const STATE: unique symbol;

export abstract class Model {
    /** Controller for this instance. */
    [CONTROL]: Model.Controller;

    /** Current state of this instance. */
    [STATE]?: Model.State<this>;

    /** Current subscriber (if present) while used in a live context (e.g. hook or effect). */
    [LOCAL]?: Model.Subscriber;

    /**
     * Last update causing a refresh to subscribers.
     * 
     * If accessed directly, will contain all keys from last push.
     * If within a subscribed function, will contain only keys which explicitly caused a refresh.
     **/
    [WHY]?: readonly string[];

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

    import <O extends Model.Compat<this>> (via: O, select?: string[]): void;

    export(): Model.State<this>;
    export <P extends Model.Fields<this>> (select: P[]): Model.State<this, P>;

    update(): PromiseLike<readonly string[] | false>;
    update(strict: true): Promise<readonly string[]>;
    update(strict: false): Promise<false>;
    update(strict: boolean): Promise<readonly string[] | false>;

    update(keys: Including<Model.Fields<this>>): Thenable<readonly string[]>;
    update(keys: Including<Model.Fields<this>>, callMethod: boolean): PromiseLike<readonly string[]>;
    update<T>(keys: Including<Model.Fields<this>>, argument: T): PromiseLike<readonly string[]>;

    /*
    Issue with self-reference, using fallback.
    
    update(keys: Model.Typeof<this, () => void>, callMethod: boolean): Thenable<string[]>;
    update(keys: Model.SelectTypeof<this, () => void>, callMethod: boolean): Thenable<string[]>;

    update<T>(keys: Model.Typeof<this, (arg: T) => void>, argument: T): Thenable<string[]>;
    update<T>(keys: Model.SelectTypeof<this, (arg: T) => void>, argument: T): Thenable<string[]>;
    */

    /** 
     * Mark this instance for garbage-collection and send `willDestroy` event to all listeners.
     * 
     * Implemented by class in-use, see `Model.willDestroy`.
     */
    destroy(): void;

    /** Attaches this controller to a component. */
    tap(): this;

    /** Tracks specific key of this controller within a component. */
    tap <K extends Model.Fields<this>> (key: K, expect: true): Exclude<this[K], undefined>;
    tap <K extends Model.Fields<this>> (key: K, expect?: boolean): this[K];

    tap <T> (from: (this: this, state: this) => Promise<T>, expect: true): Exclude<T, undefined>;
    tap <T> (from: (this: this, state: this) => Promise<T>, expect?: boolean): T | undefined;

    tap <T> (from: (this: this, state: this) => T, expect: true): Exclude<T, undefined>;
    tap <T> (from: (this: this, state: this) => T, expect?: boolean): T;
    
    // Keyed
    on <P = Model.EventsCompat<this>> (keys: [], listener: Model.UpdateCallback<this, P>, squash?: false, once?: boolean): Callback;
    on <P extends Model.EventsCompat<this>> (key: P | P[], listener: Model.UpdateCallback<this, P>, squash?: false, once?: boolean): Callback;
    // Squash
    on <P = Model.EventsCompat<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
    on <P extends Model.EventsCompat<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
    // Unknown
    on (keys: [], listener: unknown, squash: boolean, once?: boolean): Callback;
    on <P extends Model.EventsCompat<this>> (key: P | P[], listener: unknown, squash: boolean, once?: boolean): Callback;

    // Keyed
    once <P = Model.EventsCompat<this>> (keys: [], listener: Model.UpdateCallback<this, P>, squash?: false, once?: boolean): Callback;
    once <P extends Model.EventsCompat<this>> (key: P | P[], listener: Model.UpdateCallback<this, P>, squash?: false): Callback;
    // Squash
    once <P = Model.EventsCompat<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
    once <P extends Model.EventsCompat<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true): Callback;
    // Promise
    once <P = Model.EventsCompat<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
    once <P extends Model.EventsCompat<this>> (key: P | P[]): Promise<P[]>;
    // Unknown
    once (keys: [], listener: unknown, squash: boolean, once?: boolean): Callback;
    once <P extends Model.EventsCompat<this>> (key: P | P[], listener: unknown, squash: boolean): Callback;

    effect(callback: Model.EffectCallback<this>): Callback;
    effect(callback: Model.EffectCallback<this>, select: []): Callback;
    effect(callback: Model.EffectCallback<this>, select: (keyof this)[]): Callback;

    /**
     * **React Hook** - Subscribe to instance of controller within a component.
     *
     * @param callback - Run once before subscription begins.
     */
    use(callback?: (instance: this) => void): this;

    /** Use symbol to access controller of a model. */
    static CONTROL: typeof CONTROL;

    /** Use symbol to access current state of a model. */
    static STATE: typeof STATE;

    /** Use symbol to access current subscriber of a model in a live context (e.g. hook or effect). */
    static LOCAL: typeof LOCAL;

    /** Use symbol to access keys affected by last update. */
    static WHY: typeof WHY;

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
     * More efficient than `use()` if you don't need hook-based features.
     * 
     * @param callback - Run after creation of instance.
     */
    static new <T extends Class> (this: T, callback?: (instance: InstanceOf<T>) => void): InstanceOf<T>;

    /**
     * **React Hook** - Create and attach an instance of this controller a react component.
     * 
     * Note: Model will be destroyed when ambient component unmounts!
     * 
     * @param callback - Run after creation of instance.
     */
    static use <T extends Class> (this: T, callback?: (instance: InstanceOf<T>) => void): InstanceOf<T>;

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
     * **React Hook** - Fetch most instance of this controller from context, if it exists.
     * 
     * @param required - If false, may return undefined.
     */
    static get <T extends Class> (this: T, required?: true): InstanceOf<T>;

    /**
     * **React Hook** - Fetch most instance of this controller from context.
     * 
     * @param required - Unless false, will throw where instance cannot be found.
     */
    static get <T extends Class> (this: T, required: boolean): InstanceOf<T> | undefined;

    /**
     * **React Hook** - Fetch specific value from instance of this controller in context.
     */
    static get <T extends Class, I extends InstanceOf<T>, K extends Model.Fields<I>> (this: T, key: K): I[K];

    /** 
     * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
     */
    static tap <T extends Class> (this: T): InstanceOf<T>;

    /** 
     * **React Hook** - Fetch and subscribe to a value on applicable instance within ambient component.
     */
    static tap <T extends Class, I extends InstanceOf<T>, K extends Model.Fields<I>> (this: T, key: K, expect: true): Exclude<I[K], undefined>;
    static tap <T extends Class, I extends InstanceOf<T>, K extends Model.Fields<I>> (this: T, key: K, expect?: boolean): I[K];

    static tap <T, M extends Class, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => Promise<T>, expect: true): Exclude<T, undefined>;
    static tap <T, M extends Class, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => Promise<T>, expect?: boolean): T | undefined;

    static tap <T, M extends Class, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => T, expect: true): Exclude<T, undefined>;
    static tap <T, M extends Class, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => T, expect?: boolean): T;

    static meta <T extends Class>(this: T): T;

    static meta <T extends Class, K extends keyof T> (this: T, key: K, expect: true): Exclude<T[K], undefined>;
    static meta <T extends Class, K extends keyof T> (this: T, key: K, expect?: boolean): T[K];

    static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect: true): Exclude<T, undefined>;
    static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect?: boolean): T | undefined;

    static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect: true): Exclude<T, undefined>;
    static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect?: boolean): T;

    /**
     * Static equivalent of `x instanceof this`.
     * 
     * Will determine if provided class is a subtype of this one. 
     */
    static isTypeof <T extends Class>(this: T, subject: any): subject is T;
}

export class Global extends Model {
    /**
     * Update the active instance of this class.
     * Returns a thenable; resolves after successful update.
     * If instance does not already exist, one will be created. 
     **/
    static set<T extends Class>(
        this: T, updates: Model.Compat<InstanceOf<T>>
    ): PromiseLike<string[] | false>;

    /** Destroy current instance of Global, if it exists. */
    static reset(): void;
}