import {
    FunctionComponentElement,
    ProviderProps,
    Context,
    Component,
    FunctionComponent,
} from 'react';

type Class = new (...args: any) => any;
type Expecting<A extends any[]> = new(...args: A) => any
type BooleanValuesOf<T> = { [K in keyof T]: T[K] extends boolean | undefined ? K : never }
type KeyOfBooleanValueIn<T> = keyof Pick<T, BooleanValuesOf<T>[keyof T]>;
type Similar<T> = { [X in keyof T]?: T[X] };

type HandleUpdatedValue<T extends object, P extends keyof T> = 
    (this: T, value: T[P], changed: P) => void

type HandleUpdatedValues<T extends object, P extends keyof T> = 
    (this: T, values: Pick<T, P>, changed: P[]) => void

/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, on a per-value basis to know when properties are updated.
 */
interface Observable {
    refresh(...keys: string[]): void;

    on<P extends keyof this>(property: P, listener: HandleUpdatedValue<this, P>): () => void;
  
    once<T extends keyof this>(property: T, listener: HandleUpdatedValue<this, T>): void;
    once<T extends keyof this>(property: T): Promise<this[T]>;

    watch<P extends keyof this>(property: P, listener: HandleUpdatedValue<this, P>, once?: boolean): () => void;
    watch<P extends keyof this>(properties: P[], listener: HandleUpdatedValue<this, P>, once?: boolean): () => void;
}

/**
 * Model Controller
 * 
 * This represents available lifecycle callbacks. 
 * A controller, when subscribed to within a component, will run 
 * these callbacks appropriately during that component's lifecycle.
 */
interface MC {
    didCreate?(): void;
    willRender?(...args: any[]): void;
    willMount?(...args: any[]): void;
    willUpdate?(...args: any[]): void;
    didMount?(...args: any[]): void;
    willUnmount?(...args: any[]): void;
    didFocus?(parent: Controller, as: string): void;
    willLoseFocus?(parent: Controller, as: string): void;
    willCycle?(...args: any[]): void | (() => void);
    willDestroy(callback?: () => void): void;

    elementWillRender?(...args: any[]): void;
    elementWillMount?(...args: any[]): void;
    elementWillUpdate?(...args: any[]): void;
    elementDidMount?(...args: any[]): void;
    elementWillUnmount?(...args: any[]): void;
    elementWillCycle?(...args: any[]): void | (() => void);

    componentWillRender?(...args: any[]): void;
    componentWillMount?(...args: any[]): void;
    componentWillUpdate?(...args: any[]): void;
    componentDidMount?(...args: any[]): void;
    componentWillUnmount?(...args: any[]): void;
    componentWillCycle?(...args: any[]): void | (() => void);
}

/**
 * React Controller
 * 
 * Defines Higher-Order-Components (HOC's) which are bound to this controller.
 */
interface RC {
    Provider: FunctionComponent<ProviderProps<this>>;
    Input: FunctionComponent<{ to: string }>;
    Value: FunctionComponent<{ of: string }>;
}

/**
 * Instance Controller
 * 
 * Helper methods and properties available to an instance of this controller.
 */
interface IC {
    get: this;
    set: this;

    assign(props: Partial<this>): this;
    assign<K extends keyof this, P extends keyof this[K]>(key: K, value: { [X in P]?: this[K][X] }): this[K];

    tap(): this & SC;
    tap<K extends keyof this>(key?: K): this[K];

    sub(...args: any[]): this & SC;

    toggle(key: KeyOfBooleanValueIn<this>): boolean;

    destroy(): void;

    onChange<P extends keyof this>(key: P | P[]): Promise<P[]>;
    onChange<P extends keyof this>(key: P | P[], listener: HandleUpdatedValue<this, P>): void;

    export(): { [P in keyof this]: this[P] };
    export(onValue: HandleUpdatedValues<this, keyof this>, initial?: boolean): () => void;
    export<P extends keyof this>(keys: P[]): Pick<this, P>;
    export<P extends keyof this>(keys: P[], onChange: HandleUpdatedValues<this, P>, initial?: boolean): () => void;
}

/**
 * Subscription Controller
 * 
 * Methods local to this controller when accessed through a subscription.
 */
interface SC {
    use: this;
    refresh(...keys: string[]): void;
}

/**
 * Meta Controller
 * 
 * A subscribe-ready controller which watches the ***static*** values of this class. 
 * Allows for Singleton-like access to values "shared" by all instances.
 */
interface Meta extends Observable, SC {
    get: this;
    set: this;
}

interface Controller extends Observable, IC, SC, RC {}

declare class Controller {
    static global: boolean;

    static watch <T extends Class, I extends InstanceType<T>> (this: T, values: Partial<I>): I;

    static Provider: FunctionComponentElement<any>;
    static makeGlobal <T extends Class>(this: T): InstanceType<T>;

    static meta <T extends Class>(this: T): T & Meta;
    
    static use <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceType<T>;

    static uses <T extends Class, I extends InstanceType<T>, D extends Similar<I>> (this: T, data: D): I;
    static using <T extends Class, I extends InstanceType<T>, D extends Similar<I>> (this: T, data: D): I;

    static get <T extends Class> (this: T): InstanceType<T>;
    static get <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): I[K];

    static has <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): Exclude<I[K], undefined>;

    static tap <T extends Class> (this: T): InstanceType<T> & SC;
    static tap <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): I[K];

    static sub <T extends Class> (this: T, ...args: any[]): InstanceType<T>;

    static hoc <T extends Class> (this: T, fc: FunctionComponent<InstanceType<T>>): Component<any>;

    static map <D, T extends new (data: D, index: number) => any>(this: T, array: D[]): InstanceType<T>[];

    static context <T extends Class> (this: T): Context<InstanceType<T>>;
}

declare class Singleton extends Controller {}

declare function get<T extends Class> (type: T): InstanceType<T>;
declare function get<T extends Controller> (type: T, ...args: any[]): T;

declare function set<T extends Class> (type: T): (InstanceType<T>) | undefined;
declare function set<T extends Class, I extends InstanceType<T>> (type: T, init: Partial<I>): I;
declare function set<T extends {} = any> (type?: T): (T & IC);

declare const Provider: FunctionComponentElement<{
    using: Controller[]
}>

export {
    IC,
    SC,
    MC,
    Meta,
    Observable
}

export {
    get,
    set,
    Controller,
    Controller as default,
    Singleton,
    Provider
}