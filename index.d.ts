import {
    FunctionComponentElement,
    ProviderProps,
    Context,
    FunctionComponent,
} from 'react';

type Callback = () => void;
type Class = new (...args: any) => any;
type Expecting<A extends any[]> = new(...args: A) => any
type BooleanValuesOf<T> = { [K in keyof T]: T[K] extends boolean | undefined ? K : never }
type KeyOfBooleanValueIn<T> = keyof Pick<T, BooleanValuesOf<T>[keyof T]>;
type Similar<T> = { [X in keyof T]?: T[X] };

type HandleUpdatedValue<T extends object, P extends keyof T> = 
    (this: T, value: T[P], changed: P) => void

type EffectCallback = () => (() => void) | undefined
type Recursive<T> = { [P in keyof T]: Recursive<T> };
type Selector<T> = (select: Recursive<T>) => void;

/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, on a per-value basis to know when properties are updated.
 */
interface Observable {
    on<P extends keyof this>(property: P | Selector<this>, listener: HandleUpdatedValue<this, P>): Callback;
  
    once<P extends keyof this>(property: P | Selector<this>, listener: HandleUpdatedValue<this, P>): void;
    once<P extends keyof this>(property: P | Selector<this>): Promise<this[P]>;

    effect(callback: EffectCallback, select: (keyof this)[] | Selector<this>): Callback;
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
    willDestroy(callback?: Callback): void;

    elementWillRender?(...args: any[]): void;
    elementWillMount?(...args: any[]): void;
    elementWillUpdate?(...args: any[]): void;
    elementDidMount?(...args: any[]): void;
    elementWillUnmount?(...args: any[]): void;

    componentWillRender?(...args: any[]): void;
    componentWillMount?(...args: any[]): void;
    componentWillUpdate?(...args: any[]): void;
    componentDidMount?(...args: any[]): void;
    componentWillUnmount?(...args: any[]): void;
}

/**
 * React Controller
 * 
 * Defines special components which are bound to the controller.
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
    update(entries: Partial<this>): void;
    update(keys: Selector<this>): void;
    update<K extends keyof this>(keys: K[]): void;
    update<K extends keyof this>(...keys: K[]): void;

    tap(): this & SC;
    tap<K extends keyof this>(key?: K): this[K];
    tap(...keys: string[]): any;

    sub(...args: any[]): this & SC;

    destroy(): void;

    export(): { [P in keyof this]: this[P] };
    export<P extends keyof this>(select: P[] | Selector<this>): Pick<this, P>;
}

/**
 * Subscription Controller
 * 
 * Methods local to this controller when accessed through a subscription.
 */
interface SC {
    get: this;
    set: this;
}

/**
 * Meta Controller
 * 
 * A subscribe-ready controller which watches the ***static*** values of this class. 
 * Allows for Singleton-like access to values "shared" by all instances.
 */
interface Meta extends Observable, SC {}

interface Controller extends Observable, IC, SC, RC {}

declare class Controller {
    static global: boolean;

    static Provider: FunctionComponentElement<any>;
    static makeGlobal <T extends Class>(this: T): InstanceType<T>;

    static meta <T extends Class>(this: T): T & Meta;
    static meta (...keys: string[]): any;

    static create <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceType<T>;
    
    static use <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceType<T>;

    static uses <T extends Class, I extends InstanceType<T>, D extends Similar<I>> (this: T, data: D): I;
    static using <T extends Class, I extends InstanceType<T>, D extends Similar<I>> (this: T, data: D): I;

    static get <T extends Class> (this: T): InstanceType<T> & SC;
    static get <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): I[K];
    
    static tap <T extends Class> (this: T): InstanceType<T> & SC;
    static tap <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): I[K];
    static tap (...keys: string[]): any;

    static has <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): Exclude<I[K], undefined>;

    static sub <T extends Class> (this: T, ...args: any[]): InstanceType<T> & SC;

    static map <D, T extends new (data: D, index: number) => any>(this: T, array: D[]): InstanceType<T>[];

    static context <T extends Class> (this: T): Context<InstanceType<T>>;
}

declare class Singleton extends Controller {}

declare function get<T extends Class> (type: T): InstanceType<T>;

declare function set<T = any> (
    onValue: (current: T) => Callback | void
): T | undefined;

declare function ref<T = HTMLElement> (
    onValue?: (current: T) => Callback | void
): { current?: T };

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
    ref,
    Controller,
    Controller as VC,
    Controller as default,
    Singleton,
    Singleton as GC,
    Provider
}