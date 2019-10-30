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

    didInit?(): void;

    willRender?(initial: boolean, local?: BunchOf<any>): void;
    didMount?(local?: BunchOf<any>): void;
    willUnmount?(local?: BunchOf<any>): void;
  
    elementWillRender?(initial: boolean, local: BunchOf<any>): void;
    elementDidMount?(local: BunchOf<any>): void;
    elementWillUnmount?(local: BunchOf<any>): void;
  
    componentWillRender?(initial: true): void;
    componentDidMount?(): void;
    componentWillUnmount?(): void;

    on(): this;
    once(): this
    only(): this;
    not(): this;
    
    get Provider(): FunctionComponentElement<ProviderProps<this>>
    static get Provider(): FunctionComponentElement<any>;

    static create <A extends any[], T extends Expects<A>, I = InstanceType<T>> (this: T, ...args: A): SpyController<I> & I;
    static use    <A extends any[], T extends Expects<A>, I = InstanceType<T>> (this: T, ...args: A): SpyController<I> & I;
    
    static get    <T extends Class> (this: T): InstanceType<T>;
    static pull   <T extends Class, I = InstanceType<T>> (this: T): SpyController<I> & I;

    static context <T extends Class> (this: T): Context<InstanceType<T>>;
    static hook    <T extends Class, I = InstanceType<T>> (this: T): SpyController<I> & I;
}

interface MultiProviderProps {
    using: Controller[]
}

type MultiProvider = FunctionComponentElement<MultiProviderProps>

export { 
    use,
    Controller,
    Controller as default,
    MultiProvider as Provide
}