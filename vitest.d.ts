/**
 * Defines MVC specific matchers for [Vitest](https://vitest.dev/) test suites.
 * 
 * For these to work you will need to add `@expressive/mvc/vitest`
 * under `setupFiles` in your Vitest configuration. 
 */
declare namespace Vi {
  interface Assertion {
    /** Assert model does have one or more updates pending. */
    toUpdate(timeout?: number): Promise<void>;

    /** Assert model did update with keys specified. */
    toHaveUpdated(...keys: (string | symbol | number)[]): Promise<void>; 
  }
}