/// <reference path="common.d.ts" />
/// <reference path="dispatch.d.ts" />
/// <reference path="lifecycle.d.ts" />

import { Component as ReactComponent, FC, PropsWithChildren, ReactElement } from 'react';

declare namespace Controller {
    type Reference = (e: HTMLElement | null) => void;

    type RefsOnlyForString <T> = {
        [P in keyof T as T[P] extends string ? P : never]: Reference;
    }
    
    type Binder <T extends Controller> =
        & ((key: keyof T) => Reference)
        & RefsOnlyForString<T>

    type Component <P, T = Controller> =
        | FunctionComponent<P, T>
        | ClassComponent<P, T>;

    type FunctionComponent <P, T = Controller> =
        (props: P, context: T) => ReactElement<P, any> | null;
    
    type ClassComponent <P, T = Controller> =
        new (props: P, context: T) => ReactComponent<P, any>;
}

interface Controller extends Dispatch, Lifecycle {
    get: this;
    set: this;

    tap(): this;
    tap <K extends keyof this> (key?: K): this[K];
    tap(...keys: string[]): any;

    sub(...args: any[]): this;

    bind: Controller.Binder<this>;

    Provider: FC<PropsWithChildren<Partial<this>>>;
}

declare abstract class Controller {
    destroy(): void;

    didCreate?(): void;
    willDestroy?(): void;

    static use <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceOf<T>;

    static memo <A extends any[], T extends Expecting<A>> (this: T, ...args: A): InstanceOf<T>;

    static uses <T extends Class, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D): I;
    static using <T extends Class, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D): I;

    static get <T extends Class> (this: T): InstanceOf<T>;
    static get <T extends Class, I extends InstanceOf<T>, K extends keyof I> (this: T, key: K): I[K];
    
    static tap <T extends Class> (this: T): InstanceOf<T>;
    static tap <T extends Class, I extends InstanceOf<T>, K extends keyof I> (this: T, key: K): I[K];
    static tap (...keys: string[]): any;

    static has <T extends Class, I extends InstanceOf<T>, K extends keyof I> (this: T, key: K): Exclude<I[K], undefined>;

    static sub <T extends Class> (this: T, ...args: any[]): InstanceOf<T>;

    static meta <T extends Class>(this: T): T & Dispatch;
    static meta (...keys: string[]): any;

    static hoc <T extends Controller, P> (component: Controller.Component<P, T>): FC<P>;
    static wrap <T extends Controller, P> (component: Controller.Component<P, T>): FC<P>;

    static find <T extends Class>(this: T): InstanceOf<T>;

    static create <A extends any[], T extends Expecting<A>> (this: T, args?: A): InstanceOf<T>;

    static isTypeof <T extends Class>(this: T, maybe: any): maybe is T;

    static inheriting: typeof Controller | undefined;

    static Provider: FC<PropsWithChildren<{}>>;
}

declare class Singleton extends Controller {
    static current?: Singleton;
}

declare const Provider: FC<{
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