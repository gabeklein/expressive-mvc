import { Stateful } from './controller';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import { defineLazy, defineProperty } from './util';

import Oops from './issues';

type RefFunction = (e: HTMLElement | null) => void;

export function setBindings(target: Stateful){
  return Observer.define((key, on) => {
    defineLazy(target, key, function(){
      const subscriber = Subscriber.current(this);
    
      if(!subscriber)
        throw Oops.BindNotAvailable();
    
      const agent = bindRefFunctions(on);
    
      subscriber.dependant.add(agent);
    
      return agent.proxy;
    })
  })
}

function bindRefFunctions(on: Observer){
  const proxy: BunchOf<RefFunction> = {};

  let index = 0;
  const gc = new Set<Callback>();
  const refs = [] as RefFunction[];

  function bind(key: string){
    let cleanup: Callback | undefined;

    return (e: HTMLElement | null) => {
      if(cleanup){
        cleanup();
        gc.delete(cleanup);
        cleanup = undefined;
      }
      if(e)
        gc.add(
          cleanup = createBinding(e, on, key)
        );
    }
  }

  for(const key in on.state)
    defineProperty(proxy, key, {
      get(){
        try {
          return refs[index] || (
            refs[index] = bind(key)
          )
        }
        finally {
          if(++index > refs.length)
            index = 0;
        }
      }
    })

  return {
    proxy,
    listen(){},
    release(){
      gc.forEach(x => x());
    }
  }
}

export function createBinding(
  e: HTMLElement,
  control: Observer,
  key: string){

  if(e instanceof HTMLInputElement)
    return createTwoWayBinding(e, control, key);
  else
    return createOneWayBinding(e, control, key);
}

function createOneWayBinding(
  element: HTMLElement,
  parent: Observer,
  key: string){

  function sync(to: any){
    element.innerHTML = String(to);
  }

  sync(parent.state[key]);

  return parent.watch(key, sync)
}

function createTwoWayBinding(
  input: HTMLInputElement,
  parent: Observer,
  key: string){

  let last: any;

  function onUpdate(this: typeof input){
    last = (parent.subject as any)[key] = this.value;
  }

  function sync(to: any){
    if(to !== last)
      input.value = String(to);
  }

  sync(parent.state[key]);

  const release = parent.watch(key, sync);

  input.addEventListener("input", onUpdate);

  return () => {
    release();
    input.removeEventListener("input", onUpdate);
  };
}