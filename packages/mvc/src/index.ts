import { Model } from './model';

export { get } from './instruction/get';
export { ref } from './instruction/ref';
export { set } from './instruction/set';
export { use } from './instruction/use';
export { has } from './instruction/has';

export { effect } from './control';
export { Context } from './context';

export { Model, Model as default };

declare module 'vitest' {
  interface Assertion<T = any> extends Model.Matchers<T> {}
  interface AsymmetricMatchersContaining extends Model.Matchers {}
}