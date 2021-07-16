import { Controller, set } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { Subscriber } from './subscriber';
import { name } from './util';

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

    return (sub: Subscriber, cached: any) => {
      if(!sub)
        return instance;

      if("proxy" in cached)
        return cached.proxy;

      let reset: Callback | undefined;

      function setup(){
        const child =
          new Subscriber(instance, sub.callback, sub.info);

        sub.dependant.add(child);

        if(sub.active)
          child.listen();

        reset = () => {
          child.release();
          sub.dependant.delete(child);
          reset = undefined;
        }

        return cached.proxy = child.proxy;
      }

      sub.follow(key, () => {
        if(reset)
          reset();
        
        if(instance)
          setup();

        sub.callback();
      });

      return setup();
    }
  })
}

export function setParent<T extends typeof Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return set(({ subject }) => {
    const expectsType = Expects.name;
    const onType = name(subject);
    const parent = ParentRelationship.get(subject);

    if(!parent){
      if(required)
        throw Oops.ParentRequired(expectsType, onType);
    }
    else if(!(parent instanceof Expects))
      throw Oops.UnexpectedParent(expectsType, onType, name(parent));

    return { value: parent };
  })
}