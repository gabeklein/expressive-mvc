import { get as getInstruction, Model } from '@expressive/mvc';

import { get } from './get';
import { getContext, use } from './use';

declare module '@expressive/mvc' {
  namespace Model {
    export function use <T extends Model> (this: Model.New<T>, apply?: Model.Values<T>, repeat?: boolean): T;

    export function use <T extends Model> (this: Model.New<T>, callback?: (instance: T) => void, repeat?: boolean): T;

    /** Fetch instance of this class from context. */
    export function get <T extends Model> (this: Model.Type<T>, ignore?: true): T;
  
    /** Fetch instance of this class optionally. May be undefined, but will never subscribe. */
    export function get <T extends Model> (this: Model.Type<T>, required: boolean): T | undefined;
  
    export function get <T extends Model, R> (this: Model.Type<T>, factory: get.Factory<T, (() => R) | Promise<R> | R>): get.NoVoid<R>;
  
    export function get <T extends Model, R> (this: Model.Type<T>, factory: get.Factory<T, (() => R) | null>): get.NoVoid<R> | null;
  }
}

Model.get = get;
Model.use = use;

getInstruction.context = getContext

export * from '@expressive/mvc';

export { Model as default };
export { Consumer } from "./consumer";
export { Provider } from "./provider";