import { set } from './instructions';
import { issues } from './issues';
import { manage, Model } from './model';
import { Subscriber } from './subscriber';
import { name } from './util';

const Related = new WeakMap<{}, {}>();

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`
})

export function use<T extends typeof Model>(
  Peer?: T | (() => InstanceOf<T>),
  callback?: (i: Model) => void): Model {

  return set((on, key) => {
    const Proxies = new WeakMap<Subscriber, any>();
    let instance: Model | undefined;

    function newValue(next: Model){
      instance = next;

      if(next){
        Related.set(instance, on.subject);
        manage(instance);

        if(callback)
          callback(instance);
      }
    }

    function apply(sub: Subscriber){
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

    if(Peer){
      instance = Model.isTypeof(Peer)
        ? new Peer()
        : Peer()

      if(instance)
        newValue(instance);
    }

    on.manage(key, instance, newValue);

    return (local: Subscriber) => {
      if(!local)
        return instance;

      if(!Proxies.has(local))
        apply(local);

      return Proxies.get(local);
    }
  }, "use");
}

export function parent<T extends typeof Model>(
  Expects: T, required?: boolean): InstanceOf<T> {

  return set((on) => {
    const child = name(on.subject);
    const expected = Expects.name;
    const parent = Related.get(on.subject);

    if(!parent){
      if(required)
        throw Oops.ParentRequired(expected, child);
    }
    else if(!(parent instanceof Expects))
      throw Oops.UnexpectedParent(expected, child, name(parent));

    return { value: parent };
  }, "parent");
}