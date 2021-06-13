import React from 'react';

import Controller from './controller';
import { Selector } from './selector';
import Lifecycle from './lifecycle';

type RefFunction = (e: HTMLElement | null) => void;
type Expecting<A extends any[]> = new(...args: A) => any;

export namespace Model {
    type SelectFunction<T> = (arg: Required<T>) => any;

    /** Shallow replacement given all entries of Model */
    type Overlay<T, R> = { [K in keyof Entries<T>]: R };

    /** Subset of `keyof T` excluding keys defined by base Model */
    type Fields<T, E = Model> = Exclude<keyof T, keyof E>;

    /** Object containing data found in T. */
    type Entries<T, E = Model> = Pick<T, Fields<T, E>>;

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

    type SelectField<T> = SelectFunction<Omit<T, keyof Model>>;

    /** A component which accepts a specified controller. */
    type Component <P, T = Model> = FunctionComponent<P, T> | ClassComponent<P, T>;

    /**
     * A component which accepts a controller as second argument.
     * Injected as a reference would be while useing `forwardRef()`.
     */
    type FunctionComponent <P, T = Model> =
        (props: P, inject: T) => React.ReactElement<P, any> | React.ReactNode | null;
    
    /** 
     * A class component which accepts a specified controller as second argument.
     */
    type ClassComponent <P, T = Model> =
        new (props: P, inject: T) => React.Component<P, any>;
}

export interface Model extends Controller, Lifecycle {}

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
     * Plug-n-Play references for properties of this controller.
     * 
     * Matched ref-functions automatically bind between receiving element and live value of field.
     * 
     * For `<input type="text" />` this is a two-way binding.
     * User input is captured and part of controller's state/event stream.
     */
    bind: Model.Overlay<this, RefFunction>;

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

    /** Attaches this controller to a component. */
    tap(): this;

    /** Tracks specific key of this controller within a component. */
    tap <K extends Model.Fields<this>> (key?: K): this[K];

    /** Tracks specific key of this controller within a component. */
    tap <K extends Model.SelectField<this>> (key?: K): ReturnType<K>;

    /**
     * **React Hook** - Find and subcribe to applicable controller. 
     * 
     * Distinct from `tap()` as this method fill fire lifecycle events on given controller.
     * 
     * @param args - Arguments passed to controller-lifecycle methods.
    */
    sub(...args: any[]): this;

    /**
     * **React Hook** - Spawn and maintain a controller from within a component.
     * 
     * Differs from `use()` being without a subscription and lifecycle events.
     * Much more efficient if you don't need hook-based features.
     */
    static memo <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceOf<T>;

    /**
     * **React Hook** - Create and attach an instance of this controller a react component.
     * 
     * Note: Model will be destroyed when ambient component unmounts!
     * 
     * @param args - Arguments passed to constructor of `this`
     */
    static use <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceOf<T>;

    /**
     * **React Hook** - Similarly to `use`, will instanciate a controller bound to ambient component.
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
     * **React Hook** - Fetch most instance of this controller from context, if exists.
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
     * Distinct from `tap()` as this method will fire lifecycle events on given controller.
     * 
     * @param args - Arguments passed to controller-lifecycle methods.
     */
    static sub <T extends Class> (this: T, ...args: any[]): InstanceOf<T>;

    /** 
     * **React Hook** - Fetch and subscribe to *class itself* within a component.
     * 
     * This allows you to do pretty meta stuff.
     * 
     * Documentation TBD.
     */
    static meta <T extends Class>(this: T): T & Controller;

    /** 
     * **React Hook** - Fetch and subscribe to value defined on class itself using selectors.
     * 
     * Documentation TBD.
     */
    static meta <T extends Class, K extends Model.SelectField<T>> (this: T, key?: K): ReturnType<K>;

    /**
     * Produces a turn-key HOC acting as a context consumer for `this`.
     * 
     * Mainly for use with class-components which cannot access controllers via hooks.
     * 
     * @param component - Compatible component-type.
     */
    static hoc <T extends Model, P> (component: Model.Component<P, T>): React.FC<P>;

    /**
     * Produces a turn-key HOC acting as a context provider for `this`.
     * Will create instance of controller automatically, consuming props of resulting HOC. 
     * 
     * Will also inject created instance to given component via `context` parameter.
     * 
     * @param component - Compatible component-type.
     */
    static wrap <T extends Model, P> (component: Model.Component<P, T>): React.FC<P>;

    /**
     * **React Hook** - Locate most relevant instance of this type in context.
     */
    static find <T extends Class>(this: T): InstanceOf<T>;

    /**
     * Creates a new instance of this controller.
     * 
     * Beyond `new this(...)`, method will activate managed-state.
     * 
     * @param args - arguments sent to constructor
     */
    static create <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceOf<T>;

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
}