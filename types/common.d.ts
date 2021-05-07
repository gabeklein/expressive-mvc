type Callback = () => void;
type BunchOf<T> = { [key: string]: T };
type Async = (...args: any[]) => Promise<any>;

type Select<T> = (arg: T) => any;
type Recursive<T> = { [P in keyof T]: Recursive<T> };
type Selector<T> = (select: Recursive<T>) => void;

type MaybeStrings = (string | undefined)[];

type Class = new(...args: any[]) => any;
type Expecting<A extends any[]> = new(...args: A) => any;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

type EffectCallback<T, A = T> = (this: T, argument: A) => Callback | Promise<any> | void;

type ValueCallback<T, V> = (this: T, value: V, updated: keyof T) => void;
type UpdateCallback<T, P extends keyof T> = (this: T, value: T[P], changed: P) => void;