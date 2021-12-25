type BunchOf<T> = { [key: string]: T };
type ValuesOf<T> = T[keyof T];

type Key = string | symbol | number;
type KeyFactory<T> = (target: T) => Key | undefined;

type Async<T = any> = (...args: any[]) => Promise<T>;
type Class = new (...args: any[]) => any;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

type Recursive<T> = { [K in keyof T]: Recursive<Omit<T, K>> };
type Query = (select: Recursive<{}>) => void;
type Select = <T>(from: T) => T[keyof T];

type Callback = () => void;
type RequestCallback = (keys: readonly string[]) => void;
type EffectCallback<T, A = T> = (this: T, argument: A) => Callback | Promise<any> | void;
type InterceptCallback<T> = (argument: T) => ((next: T) => void) | Promise<any> | void | boolean;
type UpdateCallback<T, P extends keyof T> = (this: T, value: T[P], changed: P) => void;