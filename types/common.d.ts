type Callback = () => void;
type BunchOf<T> = { [key: string]: T };
type Similar<T> = { [X in keyof T]?: T[X] };
type Async = (...args: any[]) => Promise<any>;
type Any = { [key: string]: any };

type Select<T> = (arg: T) => any;
type Recursive<T> = { [P in keyof T]: Recursive<T> };
type Selector<T> = (select: Recursive<T>) => void;

type Class = new(...args: any[]) => any;

type MaybeStrings = (string | undefined)[];

type Expecting<A extends any[]> = new(...args: A) => any;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

type EffectCallback<T, A = T> = (this: T, self: A) => Callback | Promise<any> | void;

type DidUpdate<T, V> = (this: T, value: V, updated: keyof T) => void;
type DidUpdateSpecific<T, P extends keyof T> = (this: T, value: T[P], changed: P) => void;

type PropertyDescriptors = [string, PropertyDescriptor][];

type HandleUpdatedValue
  <T extends object = any, P extends keyof T = any> = 
  (this: T, value: T[P], changed: P) => void;