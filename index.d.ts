import {
    FunctionComponent,
    PropsWithChildren
} from 'react';

type Callback = () => void;
type BunchOf<T> = { [key: string]: T };
type Similar<T> = { [X in keyof T]?: T[X] };

type Recursive<T> = { [P in keyof T]: Recursive<T> };
type Selector<T> = (select: Recursive<T>) => void;

type Expecting<A extends any[]> = new(...args: A) => any;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never

type Model = typeof Controller;
type State<T extends Model> = InstanceOf<T>;

type UpdateCallback<T extends object, P extends keyof T> = 
    (this: T, value: T[P], changed: P) => void;

/**
 * Subscribed Controller
 * 
 * Target receives properties which assist in destructuring.
 */
type Accessible<T extends {}> = T & {
    get: T;
    set: T;
}

/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, per-value to know when updated.
 */
interface Observable {
    on<P extends keyof this>(property: P | Selector<this>, listener: UpdateCallback<this, P>): Callback;
  
    once<P extends keyof this>(property: P | Selector<this>, listener: UpdateCallback<this, P>): void;
    once<P extends keyof this>(property: P | Selector<this>): Promise<this[P]>;

    effect(
        callback: (this: this, self: this) => ((() => void) | void), 
        select?: (keyof this)[] | Selector<this>
    ): Callback;

    export(): { [P in keyof this]: this[P] };
    export<P extends keyof this>(select: P[] | Selector<this>): Pick<this, P>;

    update(entries: Partial<this>): void;
    update(keys: Selector<this>): void;
    update<K extends keyof this>(keys: K[]): void;
    update<K extends keyof this>(...keys: K[]): void;

    requestUpdate(): Promise<string[]>;
    requestUpdate(cb: (keys: string[]) => void): void;
}

/**
 * Model Lifecycle
 * 
 * Target contains available lifecycle callbacks. 
 * A controller, when subscribed to within a component, will run 
 * these callbacks appropriately during that component's lifecycle.
 */
interface WithLifecycle {
    didCreate?(): void;
    didMount?(...args: any[]): void;
    didRender?(...args: any[]): void;

    willRender?(...args: any[]): void;
    willReset?(...args: any[]): void;
    willUpdate?(...args: any[]): void;
    willMount?(...args: any[]): void;
    willUnmount?(...args: any[]): void;
    willDestroy(callback?: Callback): void;

    elementDidMount?(...args: any[]): void;
    elementWillRender?(...args: any[]): void;
    elementWillUpdate?(...args: any[]): void;
    elementWillMount?(...args: any[]): void;
    elementWillUnmount?(...args: any[]): void;

    componentDidMount?(...args: any[]): void;
    componentWillRender?(...args: any[]): void;
    componentWillUpdate?(...args: any[]): void;
    componentWillMount?(...args: any[]): void;
    componentWillUnmount?(...args: any[]): void;
}

/**
 * React Controller
 * 
 * Containing helper components which are bound to the controller.
 */
interface WithReact {
    Provider: FunctionComponent<PropsWithChildren<Partial<this>>>;
    Input: FunctionComponent<{ to: string }>;
    Value: FunctionComponent<{ of: string }>;
}

interface Controller extends Observable, WithLifecycle, WithReact {
    parent?: Controller;

    tap(): Accessible<this>;
    tap<K extends keyof this>(key?: K): this[K];
    tap(...keys: string[]): any;

    sub(...args: any[]): Accessible<this>;

    destroy(): void;
}

declare abstract class Controller {
    static use <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceType<T>;

    static uses <T extends Model, I extends State<T>, D extends Similar<I>> (this: T, data: D): I;
    static using <T extends Model, I extends State<T>, D extends Similar<I>> (this: T, data: D): I;

    static get <T extends Model> (this: T): Accessible<State<T>>;
    static get <T extends Model, I extends State<T>, K extends keyof I> (this: T, key: K): I[K];
    
    public tap (): Accessible<this>;
    static tap <T extends Model> (this: T): Accessible<State<T>>;

    public tap <K extends keyof this> (key: K): this[K];
    static tap <T extends Model, I extends State<T>, K extends keyof I> (this: T, key: K): I[K];

    public tap (...keys: string[]): any;
    static tap (...keys: string[]): any;

    static has <T extends Model, I extends State<T>, K extends keyof I> (this: T, key: K): Exclude<I[K], undefined>;

    public sub (...args: any[]): Accessible<this>;
    static sub <T extends Model> (this: T, ...args: any[]): Accessible<State<T>>;

    static meta <T extends Model>(this: T): Accessible<T & Observable>;
    static meta (...keys: string[]): any;

    static find <T extends Model>(this: T): State<T>;

    static create <A extends any[], T extends Expecting<A>> (this: T, args?: A): InstanceType<T>;

    public destroy(): void;

    static isTypeof<T extends Model>(this: T, maybe: any): maybe is T;

    static Provider: FunctionComponent<PropsWithChildren<{}>>;
}

declare class Singleton extends Controller {
    static current?: Singleton;
}

declare function use <T extends Model> (Peer: T, callback?: (i: State<T>) => void): State<T> 
declare function get <T extends Model> (type: T): State<T>;
declare function set <T = any> (onValue: (current: T) => Callback | void): T | undefined;
declare function ref <T = HTMLElement> (onValue?: (current: T) => Callback | void): { current?: T };
declare function event (callback?: () => Callback | void): Callback;

type Provider<T = typeof Controller> = 
    FunctionComponent<{ of: Array<T> | BunchOf<T> }>

export {
    WithLifecycle,
    Observable,
    State,
    Model,
    Selector,
    UpdateCallback
}

export {
    use,
    get,
    set,
    ref,
    event,
    Controller,
    Controller as VC,
    Controller as default,
    Singleton,
    Singleton as GC,
    Provider
}