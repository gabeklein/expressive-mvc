import { Singleton } from './control-global';
import { Controller } from './controller';
import { useSubscriber } from './subscriber';
import { defineOnAccess } from './util';

export const GLOBAL_INSTANCE = Symbol("controller_singleton");

export const controllerIsGlobalError = (name: string) => new Error(
  `Controller ${name} is tagged as global. Context API does not apply.`
)

export function useGlobalController(
  type: typeof Controller,
  args: any[]){

  let global = globalController(type, args);
  return useSubscriber(global, args, true);
}

export class DeferredPeerController {
  constructor(
    public type: typeof Controller
  ){}
}

export function globalController(
  type: typeof Controller, args: any[] = []){

  let instance = type[GLOBAL_INSTANCE];

  if(instance)
    return instance;

  instance = new (type as any)(...args) as Singleton;
  
  type[GLOBAL_INSTANCE] = instance;
  ensurePeersReadyToAccess(instance!);

  return instance;
}

export function lazyGlobalController(from: typeof Singleton){
  return from[GLOBAL_INSTANCE] || new DeferredPeerController(from);
}

export function ensurePeersReadyToAccess(parent: Controller){
  function getInstance(type: typeof Controller){
    if(type.global)
      return globalController(type);
    else
      throw new Error(
        `Global controller '${parent.constructor.name}' attempted to spawn '${type.name}'. ` +
        `This is not possible because '${type.name}' is not also global. ` + 
        `Did you forget to extend 'Singleton'?`
      )
  }

  for(const [property, placeholder] of Object.entries(parent))
    if(placeholder instanceof DeferredPeerController)
      defineOnAccess(parent, property, () => getInstance(placeholder.type))
}