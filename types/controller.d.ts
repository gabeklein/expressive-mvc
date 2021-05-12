import React from 'react';

import Dispatch from './dispatch';
import Lifecycle from './lifecycle';

export namespace Controller {
    /** Subset of `keyof T` excluding keys defined by base controller. */
    type Fields<T, E = Controller> = Exclude<keyof T, keyof E>;

    /** Subset of `keyof T` excluding keys defined by base controller besides lifecycle methods. */
    type Events<T, E = Controller> = Fields<T, E> | keyof Lifecycle;

    /** Object containing data to be found in T. */
    type Entries<T, E = Controller> = Pick<T, Fields<T, E>>;

    /** Object comperable to data which may be found in T. */
    type Data<T, E = Controller> = Partial<Entries<T, E>>;

    /**
     * Field selector which includes Controller-Lifecycle events.
     * Can select for any tracked-property on a specified controller.
     * 
     * Function `SelectEvent<T>` is a preferred alterative to string `keyof T`.
     * 
     * ---
     * 
     * ```js
     * Controller.on(x => x.didMountComponent, cb)
     * ```
     * is equivalent to, while also more robust than:
     * ```js
     * Controller.on(["didMountComponent"], cb)
     * ```
     * 
     * **Note**: Will not select more than one item unlike `SelectFields`
     */
    type SelectEvent<T> = SelectFunction<T, Omit<Controller, keyof Lifecycle>>;

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
     * Controller.update(x => x.foo.bar.baz)
     * ```
     * 
     * is equivalent to, while more robust than:
     * 
     * ```js
     * Controller.update(["foo", "bar", "baz"])
     * ```
     */
    type SelectFields<T> = QueryFunction<T, Controller>;

    /** A component which accepts a specified controller. */
    type Component <P, T = Controller> =
        | FunctionComponent<P, T>
        | ClassComponent<P, T>;

    /**
     * A component which accepts a controller as second argument.
     * Injected as a reference would be while useing `forwardRef()`.
     */
    type FunctionComponent <P, T = Controller> =
        (props: P, inject: T) => React.ReactElement<P, any> | React.ReactNode | null;
    
    /** 
     * A class component which accepts a specified controller as second argument.
     */
    type ClassComponent <P, T = Controller> =
        new (props: P, inject: T) => React.Component<P, any>;
}

export interface Controller extends Dispatch, Lifecycle {}

export abstract class Controller {
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
     * const { active, get: instance } = MyController.use();
     * ```
     * Is equivalent to:
     * ```js
     * const instance = MyController.use();
     * const { active } = instance;
     * ```
     * ---
     * 
     * **Access values without implying should watch:**
     * 
     * Also useful to "peek" values without implying you
     * want them watched, when accessed from a built-in hook.
     * 
     * ```js
     * const { get, firstName } = Hello.use();
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
     * Circular reference to `this` controller (similar as `get`).
     * 
     * Useful mnemonic for updating values on a controller from within components.
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
     * Plug-n-Play references cooresponding to properties of this controller.
     * 
     * Will automatically bind between chosen element and the live value of field applied.
     * 
     * For `<input type="text" />` this is a two-way binding, user-input
     * will be captured and included in controller's state/event stream as well.
     */
    bind: ReplaceAll<Controller.Entries<this>, RefFunction>
 
    /**
     * Make this instance available to children via hook-based static methods. 
     */
    Provider: React.FC<Controller.Data<this>>;

    /** 
     * Mark this instance for garbage-collection. 
     * Fires off `willDestroy` event to all listeners.
     */
    destroy(): void;

    /**
     * Callback for when a controller is deemed formally created, and is about to be in use.
     * 
     * Invoke after initial state has been locked, and instance is now aware of what values should be tracked.
     */
    didCreate?(): void;

    /** Attaches this controller to a component. */
    tap(): this;

    /** Tracks specific key of this controller within a component. */
    tap <K extends Controller.Fields<this>> (key?: K): this[K];

    /** Tracks deep property of this controller within a component. */
    tap(...keys: string[]): any;

    /**
     * **React Hook** - Find and subcribe to applicable controller. 
     * 
     * Distinct from `tap()` as this method fill fire lifecycle events on given controller.
     * 
     * @param args - Arguments passed to controller-lifecycle methods.
    */
    sub(...args: any[]): this;

    /** Description TBD */
    static memo <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceOf<T>;

    /**
     * **React Hook** - Create and attach an instance of this controller
     * a react component.
     * 
     * Note: Controller will be destroyed when ambient component unmounts!
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
     * **React Hook** - Fetch most applicable instance of this controller in context.
     */
    static get <T extends Class> (this: T): InstanceOf<T>;

    /**
     * **React Hook** - Fetch specific value from instance of this controller in context.
     */
    static get <T extends Class, I extends InstanceOf<T>, K extends Controller.Fields<I>> (this: T, key: K): I[K];
    
    /** 
     * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
     */
    static tap <T extends Class> (this: T): InstanceOf<T>;

    /** 
     * **React Hook** - Fetch and subscribe to a value on applicable instance within ambient component.
     */
    static tap <T extends Class, I extends InstanceOf<T>, K extends Controller.Fields<I>> (this: T, key: K): I[K];

    /** 
     * @experimental
     * 
     * **React Hook** - Fetch and subscribe to deep value of this controller within ambient component.
     */
    static tap (...keys: string[]): any;

    /** 
     * **React Hook** - Fetch and subscribe to a value on applicable instance within ambient component.
     * 
     * Similar to `tap(property)`, however will throw of value is undefined.
     * This makes return type non-nullable and easy to use without optional chaining.
     */
    static has <T extends Class, I extends InstanceOf<T>, K extends Controller.Fields<I>> (this: T, key: K): Exclude<I[K], undefined>;

    /**
     * **React Hook** - Attach to instance of this controller within ambient component.
     * 
     * Distinct from `tap()` as this method will fire lifecycle events on given controller.
     * 
     * @param args - Arguments passed to controller-lifecycle methods.
     */
    static sub <T extends Class> (this: T, ...args: any[]): InstanceOf<T>;

    /** 
     * **React Hook** - Fetch and subscribe to **class itself** within an ambient component.
     * 
     * This allows you to do pretty meta stuff.
     * 
     * Documentation TBD.
     */
    static meta <T extends Class>(this: T): T & Dispatch;

     /** 
     * @experimental
     * 
     * **React Hook** - Fetch and subscribe to deep value of this class within ambient component.
     */
    static meta (...keys: string[]): any;

    /**
     * Produces a turn-key HOC acting as a context consumer for `this`.
     * 
     * Mainly for use with class-components which cannot access controllers via hooks.
     * 
     * @param component - Compatible component-type.
     */
    static hoc <T extends Controller, P> (component: Controller.Component<P, T>): React.FC<P>;

    /**
     * Produces a turn-key HOC acting as a context provider for `this`.
     * Will create instance of controller automatically, consuming props of resulting HOC. 
     * 
     * Will also inject created instance to given component via `context` parameter.
     * 
     * @param component - Compatible component-type.
     */
    static wrap <T extends Controller, P> (component: Controller.Component<P, T>): React.FC<P>;

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
    static create <A extends any[], T extends Expecting<A>> (this: T, args?: A): InstanceOf<T>;

    /**
     * Static equivalent of `x instanceof this`.
     * 
     * Will determine if provided class is a subtype of this one. 
     */
    static isTypeof <T extends Class>(this: T, subject: any): subject is T;

    /** 
     * Retreives parent inherited by this class, unless it is base `Controller`.
     */
    static inherits: typeof Controller | undefined;

    /**
     * Create an instance of this Controller and provide it to all children.
     */
    static Provider: React.FC<React.PropsWithChildren<{}>>;
}

export class Singleton extends Controller {
    /** Current instance of this controller accessable anywhere. */
    static current?: Singleton;
}

export const Provider: React.FC<{
    of: Array<typeof Controller> | BunchOf<typeof Controller>
}>;