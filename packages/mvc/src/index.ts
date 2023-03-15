import { getParent } from './children';
import { setFindFunction } from './instruction/get';

export { add } from './instruction/add';
export { run } from './instruction/run';
export { get } from './instruction/get';
export { ref } from './instruction/ref';
export { set } from './instruction/set';
export { use } from './instruction/use';

export { Model } from './model';
export { Control } from './control';
export { Subscriber } from './subscriber';
export { Debug } from './debug';
export { Register } from './register';

export const Internal = {
  setFindFunction,
  getParent
}