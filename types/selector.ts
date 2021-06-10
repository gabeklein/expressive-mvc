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
}