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
    const Proxies = new WeakMap<Subscriber, any>();
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

    function init(sub: Subscriber){
      let child: Subscriber | undefined;

      function create(){
        if(!instance)
          return;

        child = new Subscriber(instance, sub.onUpdate);

        if(sub.active)
          child.commit();

        sub.dependant.add(child);
        Proxies.set(sub, child.proxy);
      }

      function refresh(){
        if(child){
          child.release();
          sub.dependant.delete(child);
          Proxies.set(sub, undefined);
          child = undefined;
        }

        create();
        sub.onUpdate();
      }

      create();
      sub.follow(key, refresh);
    }

    return (local: Subscriber) => {
      if(!local)
        return instance;

      if(!Proxies.has(local))
        init(local);

      return Proxies.get(local);
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