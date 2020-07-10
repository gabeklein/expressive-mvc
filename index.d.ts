import {
    FunctionComponentElement,
    ProviderProps,
    Context,
    Component,
    FunctionComponent,
} from 'react';

type Class = new (...args: any) => any;
type Expects<A extends any[]> = new(...args: A) => any
type BooleanValuesOf<T> = { [K in keyof T]: T[K] extends boolean | undefined ? K : never }
type KeyOfBooleanValueIn<T> = keyof Pick<T, BooleanValuesOf<T>[keyof T]>;

declare function use<I, A extends any[]> (define: new (...args: A) => I, ...args: A): Controller & I;
declare function use<I, A extends any[]> (init: (...args: A) => I, ...args: A): Controller & I;
declare function use<I> (controller: Controller): Controller;
declare function use<I> (init: I): Controller & I;

declare function get<T extends Class> (type: T): InstanceType<T>;
declare function get<T extends Class> (type: InstanceType<T>, ...args: any[]): InstanceType<T>;

declare function set<T extends Class> (type: T): (InstanceType<T> & IC) | undefined;
declare function set<T extends Class> (type: T, init: Partial<InstanceType<T>>): (InstanceType<T> & IC);
declare function set<T extends {} = any> (type?: T): (T & IC);

type HandleUpdatedValues<T extends object, P extends keyof T> = 
    (this: T, values: Pick<T, P>, changed: P[]) => void

type HandleUpdatedValue<T extends object, P extends keyof T> = 
    (this: T, value: T[P], changed: P) => void

/**
 * Model Controller, represents available lifecycle callbacks.
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

interface Observable {
    refresh(...keys: string[]): void;

    on<P extends keyof this>(property: P, listener: HandleUpdatedValue<this, P>): () => void;
  
    once<T extends keyof this>(property: T, listener: HandleUpdatedValue<this, T>): void;
    once<T extends keyof this>(property: T): Promise<this[T]>;

    observe<P extends keyof this>(property: P, listener: HandleUpdatedValue<this, P>, once?: boolean): () => void;
    observe<P extends keyof this>(properties: P[], listener: HandleUpdatedValue<this, P>, once?: boolean): () => void;
}

/**
 * Instance Controller, methods and properties available to objects with a dispatch.
 */
interface IC {
    get: this;
    set: this;
  
    Input: FunctionComponent<{ to: string }>;
    Value: FunctionComponent<{ of: string }>;

    assign(props: Partial<this>): this;
    assign<K extends keyof this, P extends keyof this[K]>(key: K, value: { [X in P]?: this[K][X] }): this[K];

    tap(): this & SC;
    tap<K extends keyof this>(key?: K): this[K];

    sub(...args: any[]): this & SC;

    toggle(key: KeyOfBooleanValueIn<this>): boolean;

    onChange<P extends keyof this>(key: P | P[]): Promise<P[]>;
    onChange<P extends keyof this>(key: P | P[], listener: HandleUpdatedValue<this, P>): void;

    export(): { [P in keyof this]: this[P] };
    export(onValue: HandleUpdatedValues<this, keyof this>, initial?: boolean): () => void;
    export<P extends keyof this>(keys: P[]): Pick<this, P>;
    export<P extends keyof this>(keys: P[], onChange: HandleUpdatedValues<this, P>, initial?: boolean): () => void;
}

/**
 * Subscription Controller, methods local to a controlled accessed through subscriptions.
 */
interface SC {
    use: this;
    refresh(...keys: string[]): void;
}

export interface Meta extends Observable, SC {
    get: this;
    set: this;
}

type Similar<T> = { [X in keyof T]?: T[X] };

interface Controller extends Observable, IC, IC, SC {}

declare class Controller {
    static global: boolean;

    static watch <T extends Class, I extends InstanceType<T>> (this: T, values: Partial<I>): I & SC;

    static get Provider(): FunctionComponentElement<any>;
    static makeGlobal<T extends Class>(this: T): InstanceType<T>;

    static meta <T extends Class>(this: T): T & Meta;
    
    static use <A extends any[], T extends Expects<A>> (this: T, ...args: A): InstanceType<T> & SC;

    static uses <T extends Class, D extends Similar<InstanceType<T>>> (this: T, data: D): InstanceType<T> & SC;
    static using <T extends Class, D extends Similar<InstanceType<T>>> (this: T, data: D): InstanceType<T> & SC;

    static get <T extends Class> (this: T): InstanceType<T>;
    static get <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): I[K];

    static has <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): Exclude<I[K], undefined>;

    static tap <T extends Class> (this: T): InstanceType<T> & SC;
    static tap <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K, main?: boolean): I[K];

    static sub <T extends Class> (this: T, ...args: any[]): InstanceType<T> & SC;

    static hoc <T extends Class> (this: T, fc: FunctionComponent<InstanceType<T>>): Component<any>;

    static map <D, T extends new (data: D, index: number) => any>(this: T, array: D[]): InstanceType<T>[];

    static context <T extends Class> (this: T): Context<InstanceType<T>>;

    Provider: FunctionComponent<ProviderProps<this>>;
}

interface MultiProviderProps {
    using: Controller[]
}

declare const MultiProvider: FunctionComponentElement<MultiProviderProps>

export { 
    IC,
    SC,
    MC,
    Observable,
    use,
    get,
    set,
    Controller,
    Controller as Singleton,
    Controller as default,
    MultiProvider as Provider
}