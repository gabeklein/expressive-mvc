import { Controller } from './controller';
import { useSubscriber } from './subscriber';
import { constructorOf, lazilyDefine, Map } from './util';

const GLOBAL_ALLOCATED = new Map<Function, Controller>();
const { entries } = Object;

export const controllerIsGlobalError = (name: string) => new Error(
  `Controller ${name} is tagged as global. Context API does not apply.`
)

export function useGlobalController(
  type: typeof Controller,
  args: any[]){

  let global = GLOBAL_ALLOCATED.get(type); 

  if(!global)
    global = initGlobalController.call(type);
    
  return useSubscriber(global!, args, true);
}

class DeferredPeerController {
  constructor(
    public type: typeof Controller
  ){}
}

export function initGlobalController(
  this: typeof Controller, ...args: any[]){

  let instance = GLOBAL_ALLOCATED.get(this);

  if(!instance){
    this.global = true;
    const constructor = constructorOf(this);
    instance = new (this as any)(...args);
    
    ensurePeersOnAccess(instance!);
  
    GLOBAL_ALLOCATED.set(constructor, instance!);
  }

  return instance;
}

export function globalController(from: typeof Controller): Controller | null;
export function globalController(from: typeof Controller, lazy: true): DeferredPeerController;
export function globalController(from: typeof Controller, lazy?: boolean){
  const global = GLOBAL_ALLOCATED.get(from);

  if(global)
    return global;
  else if(lazy === true)
    return new DeferredPeerController(from);
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
      lazilyDefine(parent, property, newSingleton)
    }
}