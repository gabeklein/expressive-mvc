declare global {
  namespace jest {
    interface Matchers<R> {
      /** Assert model does have one or more updates pending. */
      toUpdate(): Promise<R>;

      /** Assert model did update with keys specified. */
      toUpdate<R>(...keys: string[]): Promise<R>; 
    }
  }
}

export {}