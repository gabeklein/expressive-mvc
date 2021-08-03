import { set } from './instructions';
import { issues } from './issues';
import { manage, Model } from './model';
import { Subscriber } from './subscriber';
import { name } from './util';

const ParentRelationship = new WeakMap<{}, {}>();

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`
})

export function use<T extends typeof Model>(
  Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return set((on, key) => {
    const proxy = new WeakMap<Subscriber, any>();
    let instance = new Peer() as InstanceOf<T>;

    function onValue(next: InstanceOf<T>){
      instance = next;

      if(next){
        ParentRelationship.set(instance, on.subject);
        manage(instance);

        if(callback)
          callback(instance);
      }
    }

    on.manage(key, instance, onValue);
    onValue(instance);

    function extend(sub: Subscriber){
      let reset: Callback | undefined;

      function create(){
        const child = new Subscriber(instance, sub.onUpdate);

        if(sub.active)
          child.commit();

        sub.dependant.add(child);
        proxy.set(sub, child.proxy);

        reset = () => {
          child.release();
          proxy.set(sub, undefined);
          sub.dependant.delete(child);
          reset = undefined;
        }
      }

      create();
      sub.follow(key, () => {
        if(reset)
          reset();
        
        if(instance)
          create();

        sub.onUpdate();
      });
    }

    return (local: Subscriber) => {
      if(!local)
        return instance;

      if(!proxy.has(local))
        extend(local);

      return proxy.get(local);
    }
  }, "use");
}

export function parent<T extends typeof Model>(
  Expects: T, required?: boolean): InstanceOf<T> {

  return set((on) => {
    const child = name(on.subject);
    const expected = Expects.name;
    const parent = ParentRelationship.get(on.subject);

    if(!parent){
      if(required)
        throw Oops.ParentRequired(expected, child);
    }
    else if(!(parent instanceof Expects))
      throw Oops.UnexpectedParent(expected, child, name(parent));

    return { value: parent };
  }, "parent");
}