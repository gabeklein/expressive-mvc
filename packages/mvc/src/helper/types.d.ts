import { Model } from "../model";

export type Callback = () => void;
export type Class = new (...args: any[]) => any;
export type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

export type MaybePromise<T> = T | Promise<T>;

/** Type may not be undefined - instead will be null.  */
export type NoVoid<T> = T extends undefined ? null : T;

export type OptionalValues<T extends {}> = {
  [P in Model.Key<T>]: T[P] | undefined;
}

export type NonOptionalValues<T extends {}> = {
  [P in Model.Key<T>]: Exclude<T[P], undefined>;
};