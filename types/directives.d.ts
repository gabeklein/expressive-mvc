import Controller from '.';

export function use <T extends typeof Controller> (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> 

export function parent <T extends typeof Controller> (Expects: T, required: true): InstanceOf<T>;
export function parent <T extends typeof Controller> (Expects: T, required?: false): InstanceOf<T> | undefined;

export function tap <T extends Class> (type: T): InstanceOf<T>;

export function watch <T = any> (callback: EffectCallback<T>): T | undefined;
export function watch <T = any> (starting: T, callback: EffectCallback<T>): T;

export function ref <T = HTMLElement> (callback?: EffectCallback<T>): { current: T | null };

export function act <T extends Async>(action: T): T & { allowed: boolean } | undefined;

export function event (callback?: EffectCallback<any>): Callback;

export function memo <T> (compute: () => T, lazy?: boolean): T;

export function tuple <T extends readonly any[] = []> (): Readonly<T> | undefined;
export function tuple <T extends readonly any[]> (initial: T): Readonly<T>;
export function tuple <T extends {}> (initial: T): Readonly<T>;
export function tuple <T extends readonly any[]> (...values: T): Readonly<T>;

export function def <T> (value: T): T; 

export function omit <T> (value: T): T;

export function bind <P, T = HTMLElement> (Component: Controller.Component<P, T>, to: string): React.ComponentType<P>;

export function hoc <T extends Controller, P> (component: Controller.Component<P, T>): React.ComponentType<P>;

export function wrap <T extends Controller, P> (component: Controller.Component<P, T>): React.ComponentType<P>;