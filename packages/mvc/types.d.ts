export type Callback = () => void;
export type Class = new (...args: any[]) => any;
export type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

/** Type may not be undefined - instead will be null.  */
export type NoVoid<T> = T extends undefined ? null : T;

/** Including but not limited to T. */
export type Extends<T> = T | (string & Record<never, never>);

declare global {
  namespace jest {
    interface Matchers<R> {
      /** Assert model does have one or more updates pending. */
      toUpdate(): Promise<R>;
    }
  }
}