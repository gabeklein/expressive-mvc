import { Controller } from './controller';
import { useSubscriber } from './subscriber';
import { defineOnAccess } from './util';

const { entries } = Object;

export const GLOBAL_INSTANCE = Symbol("controller_singleton");

export const controllerIsGlobalError = (name: string) => new Error(
  `Controller ${name} is tagged as global. Context API does not apply.`
)

export function useGlobalController(
  type: typeof Controller,
  args: any[]){

  let global = type[GLOBAL_INSTANCE];

  if(!global)
    global = initGlobalController.apply(type, args);
    
  return useSubscriber(global!, args, true);
}

export class DeferredPeerController {
  constructor(
    public type: typeof Controller
  ){}
}

export function initGlobalController(
  this: typeof Controller, ...args: any[]){

  let instance = this[GLOBAL_INSTANCE];

  if(!instance){
    this.global = true;
    instance = new (this as any)(...args);
    this[GLOBAL_INSTANCE] = instance;
    
    ensurePeersOnAccess(instance!);
  }

  return instance;
}

export function globalController(from: typeof Controller){
  const global = from[GLOBAL_INSTANCE];

  if(global)
    return global;
  else if(from.global)
    return initGlobalController.call(from);
  else 
    return null;
}

export function ensurePeersOnAccess(parent: Controller){
  for(const [property, placeholder] of entries(parent))
    if(placeholder instanceof DeferredPeerController){
      const newSingleton = () => {
        const instance = globalController(placeholder.type);

        if(!instance)
          throw new Error(
            `Global controller '${parent.constructor.name}' attempted to spawn '${placeholder.type.name}'. ` +
            `This is not possible because '${placeholder.type.name}' is not also global. ` + 
            `Did you forget to extend 'Singleton'?`
          )

        return instance;
      }
      defineOnAccess(parent, property, newSingleton)
    }
}