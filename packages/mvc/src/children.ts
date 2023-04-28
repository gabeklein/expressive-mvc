import { Control, control } from './control';
import { issues } from './helper/issues';
import { Model } from './model';

export const Parent = new WeakMap<{}, {}>();

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`
});

export function getParent<T extends Model>(subject: Model){
  return Parent.get(subject) as T;
}

export function setRecursive(
  on: Control, key: string, value: Model
){
  const set = (next: Model | undefined) => {
    if(next instanceof value.constructor){
      on.state.set(key, next);
      Parent.set(next, on.subject);
      control(next);
      return true;
    }

    throw Oops.BadAssignment(`${on.subject}.${key}`, value.constructor, next);
  }

  on.watch(key, { set });
  set(value);
}