import {
    FunctionComponentElement,
    ProviderProps,
    Context,
} from 'react';

type Class = new (...args: any) => any;
type Expects<A extends any[]> = new(...args: A) => any

declare function use<I, A extends any[]> (define: new (...args: A) => I, ...args: A): Controller & I;
declare function use<I, A extends any[]> (init: (...args: A) => I, ...args: A): Controller & I;
declare function use<I> (controller: Controller): Controller;
declare function use<I> (init: I): Controller & I;

interface SpyController<T> {
    on(...properties: string[]): SpyController<T> | T;
    not(...properties: string[]): SpyController<T> | T;
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

    componentWillRender?(): void;
    componentDidMount?(): void;
    componentWillUnmount?(): void;

    elementWillRender?(): void;
    elementDidMount?(): void;
    elementWillUnmount?(): void;

    on(): this;
    once(): this
    only(): this;
    not(): this;
    
    get Provider(): FunctionComponentElement<ProviderProps<this>>
    static get Provider(): FunctionComponentElement<any>;

    static create <A extends any[], T extends Expects<A>, I = InstanceType<T>> (this: T, ...args: A): SpyController<I> & I;
    static use    <A extends any[], T extends Expects<A>, I = InstanceType<T>> (this: T, ...args: A): SpyController<I> & I;
    static get    <A extends any[], T extends Expects<A>, I = InstanceType<T>> (this: T, ...args: A): I;
    static pull   <A extends any[], T extends Expects<A>, I = InstanceType<T>> (this: T, ...args: A): SpyController<I> & I;

    static context <T extends Class> (this: T): Context<InstanceType<T>>;
    static hook    <T extends Class, I = InstanceType<T>> (this: T): SpyController<I> & I;
}

export { 
    use,
    Controller,
    Controller as default
}