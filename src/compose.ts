import { Controller, set } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { define } from './util';

const ParentRelationship = new WeakMap<{}, {}>();

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`
})

export function setChild<T extends typeof Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return set((key, on) => {
    const instance = new Peer() as InstanceOf<T>;

    on.register(key, instance);
    ParentRelationship.set(instance, on.subject);
    Controller.ensure(instance);

    if(callback)
      callback(instance);
  })
}

export function setParent<T extends typeof Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return set((key, { subject }) => {
    const expectsType = Expects.name;
    const onType = subject.constructor.name;
    const parent = ParentRelationship.get(subject);

    if(!parent){
      if(required)
        throw Oops.ParentRequired(expectsType, onType);
    }
    else if(!(parent instanceof Expects)){
      const gotType = parent.constructor.name;
      throw Oops.UnexpectedParent(expectsType, onType, gotType);
    }

    define(subject, key, parent);
  })
}