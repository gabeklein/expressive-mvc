import { Component as ReactComponent, FC, PropsWithChildren, ReactElement, ReactNode } from 'react';

/**
 * Observable Instance
 * 
 * Implements internal value tracking. 
 * Able to be subscribed to, per-value to know when updated.
 */
interface Observable {
    on <S extends Select<this>> (via: S, cb: DidUpdate<this, ReturnType<S>>, initial?: boolean): Callback;
    on <P extends keyof this> (property: P, listener: DidUpdateSpecific<this, P>, initial?: boolean): Callback;
  
    once <S extends Select<this>> (via: S): Promise<ReturnType<S>>;
    once <S extends Select<this>> (via: S, cb: DidUpdate<this, ReturnType<S>>): Callback;

    once <P extends keyof this> (property: P): Promise<this[P]>;
    once <P extends keyof this> (property: P, listener: DidUpdateSpecific<this, P>): void;

    effect(callback: EffectCallback<this>, select?: (keyof this)[] | Selector<this>): Callback;

    export(): this;
    export <P extends keyof this> (select: P[] | Selector<this>): Pick<this, P>;

    update <T extends this> (entries: Partial<T>): void;
    update(keys: Selector<this>): void;
    update <K extends keyof this> (keys: K[]): void;

    requestUpdate(strict?: boolean): Promise<string[] | false>;
    requestUpdate(timeout: number): Promise<string[] | false>;
    requestUpdate(cb: (keys: string[]) => void): void;
}

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
        (props: P, context: T) => JSX.Element | ReactElement | ReactNode | null;
    
    type ClassComponent <P, T = Controller> = {
        new (props: P, context: T): ReactComponent<P, any>;
    }
    
    type ComponentWithRef <T, P = {}> =
        (props: PropsWithChildren<P>, ref: (instance: T | null) => void) => ReactElement | null;

    type ProviderProps <T = typeof Controller> = {
        of: Array<T> | BunchOf<T>
    };
}

interface Controller extends Observable, Lifecycle {
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

    static uses <T extends Class, I extends InstanceOf<T>, D extends Similar<I>> (this: T, data: D): I;
    static using <T extends Class, I extends InstanceOf<T>, D extends Similar<I>> (this: T, data: D): I;

    static get <T extends Class> (this: T): InstanceOf<T>;
    static get <T extends Class, I extends InstanceOf<T>, K extends keyof I> (this: T, key: K): I[K];
    
    static tap <T extends Class> (this: T): InstanceOf<T>;
    static tap <T extends Class, I extends InstanceOf<T>, K extends keyof I> (this: T, key: K): I[K];
    static tap (...keys: string[]): any;

    static has <T extends Class, I extends InstanceOf<T>, K extends keyof I> (this: T, key: K): Exclude<I[K], undefined>;

    static sub <T extends Class> (this: T, ...args: any[]): InstanceOf<T>;

    static meta <T extends Class>(this: T): T & Observable;
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

declare const Provider: FC<Controller.ProviderProps>;

export {
    Controller,
    Controller as VC,
    Controller as default,
    Singleton,
    Singleton as GC,
    Provider
}

export * from "./directives";