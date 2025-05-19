/**
 * Defines MVC specific matchers for [Jest](https://jestjs.io/) test suites.
 * 
 * For these to work you will need to add `@expressive/mvc/jest`
 * under `setupFilesAfterEnv` in your Jest configuration. 
 */
declare namespace jest {
  interface Matchers<R> {
    /** Assert model does have one or more updates pending. */
    toUpdate(timeout?: number): Promise<R>;

    /** Assert model did update with keys specified. */
    toHaveUpdated<R>(...keys: (string | symbol | number)[]): Promise<R>; 
  }
}