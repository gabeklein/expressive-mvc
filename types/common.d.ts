type BunchOf<T> = { [key: string]: T };
type Recursive<T> = { [K in keyof T]: Recursive<Omit<T, K>> };

type SelectFunction<T, O = {}> = (arg: Omit<Required<T>, keyof O>) => any;
type QueryFunction<T, O = {}> = (select: Recursive<Omit<Required<T>, keyof O>>) => void;

type Class = new (...args: any[]) => any;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

type Callback = () => void;
type RequestCallback = (keys: string[]) => void;
type EffectCallback<T, A = T> = (this: T, argument: A) => Callback | Promise<any> | void;
type UpdateCallback<T, P extends keyof T> = (this: T, value: T[P], changed: P) => void;