export { add } from './instruction/add';
export { get } from './instruction/get';
export { ref } from './instruction/ref';
export { set } from './instruction/set';
export { use } from './instruction/use';
export { has } from './instruction/has';

export { Model, Model as default } from './model';
export { Context } from './context';

declare global {
  /**
   * Defines MVC specific matchers for [Jest](https://jestjs.io/) test suites.
   * 
   * For these to work you will need to add `@expressive/mvc/jest`
   * under `setupFilesAfterEnv` in your Jest configuration. 
   */
  namespace jest {
    interface Matchers<R> {
      /** Assert model does have one or more updates pending. */
      toUpdate(timeout?: number): Promise<R>;

      /** Assert model did update with keys specified. */
      toHaveUpdated<R>(...keys: (string | symbol | number)[]): Promise<R>; 
    }
  }
}