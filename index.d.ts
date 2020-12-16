import {
    Component,
    ComponentType,
    FunctionComponent,
    PropsWithChildren,
    ReactElement,
    ReactNode
} from 'react';

type Callback = () => void;
type BunchOf<T> = { [key: string]: T };
type Similar<T> = { [X in keyof T]?: T[X] };

type Recursive<T> = { [P in keyof T]: Recursive<T> };
type Selector<T> = (select: Recursive<T>) => void;

type Class = new (...args: any[]) => void;
type Expecting<A extends any[]> = new(...args: A) => any;
type Instance<T> = T extends { prototype: infer U } ? U : never

type Model = typeof Controller;

type UpdateCallback<T extends object, P extends keyof T> = 
    (this: T, value: T[P], changed: P) => void;

/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, per-value to know when updated.
 */
interface Observable {
    on<P extends keyof this>(property: P | Selector<this>, listener: UpdateCallback<this, P>, initial?: boolean): Callback;
  
    once<P extends keyof this>(property: P | Selector<this>, listener: UpdateCallback<this, P>): void;
    once<P extends keyof this>(property: P | Selector<this>): Promise<this[P]>;

    effect(
        callback: (this: this, self: this) => ((() => void) | void), 
        select?: (keyof this)[] | Selector<this>
    ): Callback;

    export(): this;
    export<P extends keyof this>(select: P[] | Selector<this>): Pick<this, P>;

    update<T extends this>(entries: Partial<T>): void;
    update(keys: Selector<this>): void;
    update<K extends keyof this>(keys: K[]): void;
    update<K extends keyof this>(...keys: K[]): void;

    requestUpdate(strict?: boolean): Promise<string[] | false>;
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
}

interface Controller extends Observable, WithLifecycle, WithReact {
    get: this;
    set: this;

    tap(): this;
    tap<K extends keyof this>(key?: K): this[K];
    tap(...keys: string[]): any;

    sub(...args: any[]): this;

    bind(key: string): (e: HTMLElement | null) => void;

    destroy(): void;
}

declare abstract class Controller {
    static use <A extends any[], T extends Expecting<A>> (this: T, ...args: A): Instance<T>;

    static memo <A extends any[], T extends Expecting<A>> (this: T, ...args: A): Instance<T>;

    static uses <T extends Class, I extends Instance<T>, D extends Similar<I>> (this: T, data: D): I;
    static using <T extends Class, I extends Instance<T>, D extends Similar<I>> (this: T, data: D): I;

    static get <T extends Class> (this: T): Instance<T>;
    static get <T extends Class, I extends Instance<T>, K extends keyof I> (this: T, key: K): I[K];
    
    static tap <T extends Class> (this: T): Instance<T>;
    static tap <T extends Class, I extends Instance<T>, K extends keyof I> (this: T, key: K): I[K];
    static tap (...keys: string[]): any;

    static has <T extends Class, I extends Instance<T>, K extends keyof I> (this: T, key: K): Exclude<I[K], undefined>;

    static sub <T extends Class> (this: T, ...args: any[]): Instance<T>;

    static meta <T extends Class>(this: T): T & Observable;
    static meta (...keys: string[]): any;

    static hoc<T extends Controller, P> (component: ControllableComponent<P, T>): FunctionComponent<P>;
    static wrap<T extends Controller, P> (component: ControllableComponent<P, T>): FunctionComponent<P>;

    static find <T extends Class>(this: T): Instance<T>;

    static create <A extends any[], T extends Expecting<A>> (this: T, args?: A): Instance<T>;

    static isTypeof<T extends Class>(this: T, maybe: any): maybe is T;

    static inheriting: Model | undefined;

    static Provider: FunctionComponent<PropsWithChildren<{}>>;
}

declare class Singleton extends Controller {
    static current?: Singleton;
}

interface ControllableFC <P, T = Controller> {
    (props: P, context: T): JSX.Element | ReactElement | ReactNode | null;
}

interface ControllableCC <P, T = Controller> {
    new (props: P, context: T): Component<P, any>
}

type ControllableComponent<P, T = Controller> =
    | ControllableFC<P, T>
    | ControllableCC<P, T>

interface ControllableRefFunction<T, P = {}> {
    (props: PropsWithChildren<P>, ref: (instance: T | null) => void): ReactElement | null;
}
      
declare function use <T extends Model> (Peer: T, callback?: (i: Instance<T>) => void): Instance<T> 
declare function parent <T extends Model> (Expects: T, required: true): Instance<T>;
declare function parent <T extends Model> (Expects: T, required?: false): Instance<T> | undefined;
declare function get <T extends Model> (type: T): Instance<T>;
declare function watch <T = any> (onValue: (current: T) => Callback | void): T | undefined;
declare function ref <T = HTMLElement> (onValue?: (current: T) => Callback | void): { current: T | null };
declare function event (callback?: () => Callback | void): Callback;
declare function memo <T> (compute: () => T, lazy?: boolean): T;
declare function hoc <T extends Controller, P> (component: ControllableComponent<P, T>): ComponentType<P>;
declare function bind<P, T = HTMLElement> (Component: ControllableRefFunction<T, P>, to: string): ComponentType<P>;
declare function tuple<T extends readonly any[] = []> (): Readonly<T> | undefined;
declare function tuple<T extends readonly any[]> (initial: T): Readonly<T>;
declare function tuple<T extends {}> (initial: T): Readonly<T>;
declare function tuple<T extends readonly any[]> (...values: T): Readonly<T>;
declare function def<T> (value: T): T; 
declare function omit<T> (value: T): T;

type Provider<T = typeof Controller> = 
    FunctionComponent<{ of: Array<T> | BunchOf<T> }>

export {
    WithLifecycle,
    ControllableComponent,
    ControllableFC,
    ControllableCC,
    Observable,
    Instance,
    Selector,
    UpdateCallback,
    ControllableRefFunction
}

export {
    Controller,
    Controller as VC,
    Controller as default,
    Singleton,
    Singleton as GC,
    Provider
}

export {
    use,
    parent,
    get,
    watch,
    ref,
    event,
    memo,
    hoc,
    hoc as wrap,
    bind,
    tuple,
    def,
    omit
}