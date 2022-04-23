type Async<T = any> = (...args: any[]) => Promise<T>;
type BunchOf<T> = { [key: string]: T };
type Callback = () => void;
type Class = new (...args: any[]) => any;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

type RequestCallback = (keys: readonly string[]) => void;
type EffectCallback<T, A = T> = (this: T, argument: A) => Callback | Promise<any> | void;
type AssignCallback<T, S = any> = (this: S, argument: T, thisArg: S) => ((next: T) => void) | Promise<any> | void | boolean;
type UpdateCallback<T, P extends keyof T> = (this: T, value: T[P], changed: P) => void;

type IfApplicable<T extends {}, K> = K extends keyof T ? T[K] : undefined;
type Including<T> = T | (string & Record<never, never>);