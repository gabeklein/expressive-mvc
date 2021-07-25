import { set } from './instructions';
import { issues } from './issues';
import { Model } from './model';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import { name } from './util';

const ParentRelationship = new WeakMap<{}, {}>();

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`
})

export function use<T extends typeof Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return set((on: Observer, key) => {
    const proxy = new WeakMap<Subscriber, any>();
    let instance = new Peer() as InstanceOf<T>;

    function update(current: InstanceOf<T>){
      instance = current;

      if(current){
        ParentRelationship.set(instance, on.subject);
        Observer.ensure(instance);
    
        if(callback)
          callback(instance);
      }
    }

    function init(sub: Subscriber){
      const { dependant } = sub;
      let reset: Callback | undefined;

      function setup(){
        const child = Observer
          .ensure(instance)
          .subscribe(sub.onUpdate);

        if(sub.active)
          child.commit();

        dependant.add(child);
        proxy.set(sub, child.proxy);

        reset = () => {
          child.release();
          proxy.set(sub, undefined);
          dependant.delete(child);
          reset = undefined;
        }
      }

      setup();
      sub.follow(key, () => {
        if(reset)
          reset();
        
        if(instance)
          setup();

        sub.onUpdate();
      });
    }

    update(instance);
    on.manage(key, instance, update);

    return (current: Subscriber) => {
      if(!current)
        return instance;

      if(!proxy.has(current))
        init(current);

      return proxy.get(current);
    }
  })
}

export function parent<T extends typeof Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return set(({ subject }) => {
    const child = name(subject);
    const expected = Expects.name;
    const parent = ParentRelationship.get(subject);

    if(!parent){
      if(required)
        throw Oops.ParentRequired(expected, child);
    }
    else if(!(parent instanceof Expects))
      throw Oops.UnexpectedParent(expected, child, name(parent));

    return { value: parent };
  })
}