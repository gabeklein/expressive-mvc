/// <reference path="common.d.ts" />

import React from 'react';

import Dispatch from './dispatch';
import Lifecycle from './lifecycle';

declare namespace Controller {
    type Fields<T> = Exclude<keyof T, keyof Controller>;
    type Entries<T extends Controller> = Omit<T, keyof Controller>;

    type Select<T extends Controller> = SelectFunction<T, Controller>;
    type Query<T extends Controller> = QueryFunction<T, Controller>;

    type Binder <T extends Controller> =
        & ((key: Fields<T>) => RefFunction)
        & ReplaceAll<Entries<T>, RefFunction>

    type Component <P, T = Controller> =
        | FunctionComponent<P, T>
        | ClassComponent<P, T>;

    type FunctionComponent <P, T = Controller> =
        (props: P, inject: T) => React.ReactElement<P, any> | React.ReactNode | null;
    
    type ClassComponent <P, T = Controller> =
        new (props: P, inject: T) => React.Component<P, any>;
}

interface Controller extends Dispatch, Lifecycle {}

declare abstract class Controller {
    get: this;
    set: this;

    destroy(): void;

    didCreate?(): void;
    willDestroy?(): void;

    tap(): this;
    tap <K extends Controller.Fields<this>> (key?: K): this[K];
    tap(...keys: string[]): any;

    sub(...args: any[]): this;

    bind: Controller.Binder<this>;

    Provider: React.FC<Partial<Controller.Entries<this>>>;

    static use <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceOf<T>;

    static memo <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceOf<T>;

    static uses <T extends Class, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D): I;
    static using <T extends Class, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D): I;

    static get <T extends Class> (this: T): InstanceOf<T>;
    static get <T extends Class, I extends InstanceOf<T>, K extends Controller.Fields<T>> (this: T, key: K): I[K];
    
    static tap <T extends Class> (this: T): InstanceOf<T>;
    static tap <T extends Class, I extends InstanceOf<T>, K extends Controller.Fields<T>> (this: T, key: K): I[K];
    static tap (...keys: string[]): any;

    static has <T extends Class, I extends InstanceOf<T>, K extends Controller.Fields<T>> (this: T, key: K): Exclude<I[K], undefined>;

    static sub <T extends Class> (this: T, ...args: any[]): InstanceOf<T>;

    static meta <T extends Class>(this: T): T & Dispatch;
    static meta (...keys: string[]): any;

    static hoc <T extends Controller, P> (component: Controller.Component<P, T>): React.FC<P>;
    static wrap <T extends Controller, P> (component: Controller.Component<P, T>): React.FC<P>;

    static find <T extends Class>(this: T): InstanceOf<T>;

    static create <A extends any[], T extends Expecting<A>> (this: T, args?: A): InstanceOf<T>;

    static isTypeof <T extends Class>(this: T, maybe: any): maybe is T;

    static inheriting: typeof Controller | undefined;

    static Provider: React.FC<React.PropsWithChildren<{}>>;
}

declare class Singleton extends Controller {
    static current?: Singleton;
}

declare const Provider: React.FC<{
    of: Array<typeof Controller> | BunchOf<typeof Controller>
}>;

export {
    Controller,
    Controller as VC,
    Controller as default,
    Singleton,
    Singleton as GC,
    Provider
}

export * from "./directives";