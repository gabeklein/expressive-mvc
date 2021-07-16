import { Controller, set } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { Subscriber } from './subscriber';

const ParentRelationship = new WeakMap<{}, {}>();

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`
})

export function setChild<T extends typeof Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return set((on, key) => {
    let instance = new Peer() as InstanceOf<T>;

    function init(current: InstanceOf<T>){
      if(instance = current){
        ParentRelationship.set(instance, on.subject);
        Controller.ensure(instance);
    
        if(callback)
          callback(instance);
      }
    }

    init(instance);
    on.register(key, instance, init);

    return (sub, cached) => {
      if(!sub)
        return instance;

      if("proxy" in cached)
        return cached.proxy;

      const update = sub.callback;
      let reset: Callback | undefined;

      function setup(){
        const child =
          new Subscriber(instance, update, sub.metadata);

        sub.dependant.add(child);

        if(sub.active)
          child.listen();

        reset = () => {
          child.release();
          sub.dependant.delete(child);
          reset = undefined;
        }

        cached.proxy = child.proxy;
      }

      setup();
      sub.follow(key, () => {
        if(reset)
          reset();
        
        if(instance)
          setup();

        update();
      });

      return cached.proxy;
    }
  })
}

export function setParent<T extends typeof Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return set(({ subject }) => {
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

    return { value: parent };
  })
}