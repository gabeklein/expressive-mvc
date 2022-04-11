type BunchOf<T> = { [key: string]: T };
type ValuesOf<T> = T[keyof T];

type Key = string | symbol | number;
type KeyFactory<T> = (target: T) => Key | undefined;

type Async<T = any> = (...args: any[]) => Promise<T>;
type Class = new (...args: any[]) => any;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

type Callback = () => void;
type RequestCallback = (keys: readonly string[]) => void;
type EffectCallback<T, A = T> = (this: T, argument: A) => Callback | Promise<any> | void;
type AssignCallback<T, S = any> = (this: S, argument: T, thisArg: S) => ((next: T) => void) | Promise<any> | void | boolean;

type UpdateCallback<T, P extends keyof T> = (this: T, value: T[P], changed: P) => void;
