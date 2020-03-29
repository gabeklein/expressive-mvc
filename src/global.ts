import { ModelController } from './types';
import { useSubscriber } from './subscriber';
import { constructorOf, Map, defineInitializer } from './util';

const GLOBAL_ALLOCATED = new Map<Function, ModelController>();
const { entries } = Object;

const globalNotFoundError = (name: string) => new Error(
  `Controller ${name} is tagged as global. Instance must exist before use.`
)

export const controllerIsGlobalError = (name: string) => new Error(
  `Controller ${name} is tagged as global. Context API does not apply.`
)

export function useGlobalController(
  type: typeof ModelController,
  args: any[]){

  let global = GLOBAL_ALLOCATED.get(type); 

  if(!global){
    if(!type.global)
      throw globalNotFoundError(type.name)

    global = initGlobalController.call(type);
  }
    
  return useSubscriber(global, args, true);
}

class DeferredPeerController {
  constructor(
    public type: typeof ModelController
  ){}
}

export function initGlobalController(this: typeof ModelController){
  let instance = GLOBAL_ALLOCATED.get(this);

  if(!instance){
    this.global = true;
    const constructor = constructorOf(this);
    instance = new this();
    
    ensurePeersOnAccess(instance);
  
    GLOBAL_ALLOCATED.set(constructor, instance);
  }

  return instance;
}

export function globalController(from: typeof ModelController): ModelController | null;
export function globalController(from: typeof ModelController, mustExist: false): DeferredPeerController;
export function globalController(from: typeof ModelController, mustExist: true): ModelController | never;
export function globalController(from: typeof ModelController, mustExist?: boolean){
  const global = GLOBAL_ALLOCATED.get(from);

  if(global)
    return global;
  else if(from.global)
    return initGlobalController.call(from);
  else if(mustExist)
    throw globalNotFoundError(from.name);
  else if(mustExist === false)
    return new DeferredPeerController(from);
  else 
    return null;
}

export function ensurePeersOnAccess(instance: ModelController){
  for(const [property, placeholder] of entries(instance))
    if(placeholder instanceof DeferredPeerController){
      const newSingleton = () => globalController(placeholder.type, true);
      defineInitializer(instance, property, newSingleton)
    }
}