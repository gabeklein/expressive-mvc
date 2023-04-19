export {};

declare global {
  namespace jest {
    interface Matchers<R> {
      /** Assert model does have one or more updates pending. */
      toUpdate(): Promise<R>;
    }
  }
}