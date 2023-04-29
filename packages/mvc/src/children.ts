import { Control, control, controls } from './control';
import { issues } from './helper/issues';
import { Model } from './model';

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`
});

export function setRecursive(
  on: Control, key: string, value: Model
){
  const set = (next: Model | undefined) => {
    if(next instanceof value.constructor){
      on.state.set(key, next);
      controls(next).parent = on.subject;
      control(next);
      return true;
    }

    throw Oops.BadAssignment(`${on.subject}.${key}`, value.constructor, next);
  }

  on.watch(key, { set });
  set(value);
}