export type KeysOfType<T, ST> = {
    [Key in keyof T]: T[Key] extends ST ? Key : never
}[keyof T];

export namespace Selector {
  /**
   * Shallow-recursive clone of source object.
   * Accumulates keys by property access.
   * 
   * For every key:
   * - add key to register
   * - delete key from object
   * - return object
   */
  type Object<T extends {} = {}, KS extends keyof T = never> = {
      [K in Exclude<keyof T, KS>]: Object<T, KS | K>
  };

  type Keys<S extends Object> =
      S extends Object<any, infer I> ? I : never;

  type Values<S extends Object> =
      S extends Object<infer T, infer I> ? T[I] : never;

  export type Function<T> =
      (selector: Object<T>) => Object<T, keyof T>;

  export type From<F extends Function<any>> =
      F extends (spy: any) => infer R ? Keys<R> : never;

  export type Gets<F extends Function<any>> =
      F extends (spy: any) => infer R ? Values<R> : never;

  export type Callback<S extends Function<any>, T> =
      (this: T, value: Gets<S>, key: From<S>) => void;
}

export namespace Select {
    export type One<T> =
        (arg: { [K in keyof T]: K }) => string & keyof T;

    export type Key<T extends string | number | symbol> =
        (arg: { [K in T]: K }) => string & T;

    export type From<T extends One<any>> =
        T extends (from: any) => infer R ? R : never;
}