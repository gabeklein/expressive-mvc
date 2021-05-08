type BunchOf<T> = { [key: string]: T };
type Recursive<T> = { [K in keyof T]: Recursive<Omit<T, K>> };
type ReplaceAll<T, R> = { [K in keyof T]: R };

type SelectFunction<T, O = {}> = (arg: Omit<Required<T>, keyof O>) => any;
type QueryFunction<T, O = {}> = (select: Recursive<Omit<Required<T>, keyof O>>) => void;

type StringsOptional = (string | undefined)[];
type Async = (...args: any[]) => Promise<any>;
type Class = new (...args: any[]) => any;
type Expecting<A extends any[]> = new(...args: A) => any;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

type Callback = () => void;
type EffectCallback<T, A = T> = (this: T, argument: A) => Callback | Promise<any> | void;
type ValueCallback<T, V> = (this: T, value: V, updated: keyof T) => void;
type UpdateCallback<T, P extends keyof T> = (this: T, value: T[P], changed: P) => void;