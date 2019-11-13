import {
    FunctionComponentElement,
    ProviderProps,
    Context,
} from 'react';

type Class = new (...args: any) => any;
type Expects<A extends any[]> = new(...args: A) => any
type BunchOf<T> = { [key: string]: T }

declare function use<I, A extends any[]> (define: new (...args: A) => I, ...args: A): Controller & I;
declare function use<I, A extends any[]> (init: (...args: A) => I, ...args: A): Controller & I;
declare function use<I> (controller: Controller): Controller;
declare function use<I> (init: I): Controller & I;

interface Subscriber<T> {
    on(...properties: string[]): Subscriber<T> | T;
    not(...properties: string[]): Subscriber<T> | T;
    only(...properties: string[]): T;
    once(): T;
    except: never;
}

declare class Controller {
    set: this;
    get: this;
    hold: boolean;

    refresh(...keys: string[]): void;
    export(): { [P in keyof this]: this[P] };
    add(key: string, initial?: any, bootup?: true): boolean;

    didInit?(): void;
    willDestroy(callback?: () => void): void;

    willRender?(...args: any[]): void;
    willMount?(...args: any[]): void;
    willUpdate?(...args: any[]): void;
    didMount?(...args: any[]): void;
    willUnmount?(...args: any[]): void;

    elementWillRender?(...args: any[]): void;
    elementWillMount?(...args: any[]): void;
    elementWillUpdate?(...args: any[]): void;
    elementDidMount?(...args: any[]): void;
    elementWillUnmount?(...args: any[]): void;

    componentWillRender?(): void;
    componentWillMount?(): void;
    componentWillUpdate?(): void;
    componentDidMount?(): void;
    componentWillUnmount?(): void;

    on(): this;
    once(): this
    only(): this;
    not(): this;
    
    get Provider(): FunctionComponentElement<ProviderProps<this>>
    static get Provider(): FunctionComponentElement<any>;
    
    static create <A extends any[], T extends Expects<A>> (this: T, ...args: A): InstanceType<T>;
    static use    <A extends any[], T extends Expects<A>> (this: T, ...args: A): InstanceType<T> & Subscriber<InstanceType<T>>;
    
    static fetch  <T extends Class> (this: T): InstanceType<T>;
    static watch <T extends Class> (this: T): InstanceType<T> & Subscriber<InstanceType<T>>;
    static get <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): I[K];
    static tap <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): I[K];
    
    static sub<T extends Class> (this: T): InstanceType<T>;
    static context <T extends Class> (this: T): Context<InstanceType<T>>;
}

interface MultiProviderProps {
    using: Controller[]
}

type MultiProvider = FunctionComponentElement<MultiProviderProps>

export { 
    use,
    Controller,
    Controller as default,
    MultiProvider as Provider
}