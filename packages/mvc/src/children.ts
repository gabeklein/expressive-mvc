import { Control, control, detect, observer } from './control';
import { issues } from './helper/issues';
import { Model } from './model';

export const Parent = new WeakMap<{}, {}>();

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`,

  Unexpected: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`,
});

export function getParent<T extends Model>(
  from: Model,
  type?: Model.Class<T>){

  const value = Parent.get(from) as T;

  if(value && type && !(value instanceof type))
    throw Oops.Unexpected(type, from, value);

  return value;
}

export function getRecursive(key: string, from: Control){
  return (source: Model) => {
    const event = observer(source);
    const value = from.state.get(key);

    return event && value instanceof Model
      ? detect(value, event)
      : value;
  }
}

export function setRecursive(
  on: Control, key: string, initial: Model
): Control.PropertyDescriptor {
  const expected = initial.constructor;
  const get = getRecursive(key, on);
  const set = (next: Model | undefined) => {
    if(next instanceof expected){
      on.state.set(key, next);
      Parent.set(next, on.subject);
      control(next);
      return true;
    }

    throw Oops.BadAssignment(`${on.subject}.${key}`, expected, next);
  }

  set(initial);
  
  return { get, set };
}