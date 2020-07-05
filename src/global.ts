import { Controller, Singleton } from './controller';
import { ensureDispatch } from './dispatch';

export const GLOBAL_INSTANCE = Symbol("controller_singleton");

export const controllerIsGlobalError = (name: string) => new Error(
  `Controller ${name} is tagged as global. Context API does not apply.`
)

export function globalController(
  type: typeof Controller, 
  args: any[] = [],
  callback?: (self: Controller) => void
){
  let instance = type[GLOBAL_INSTANCE];

  if(instance)
    return instance;

  instance = new (type as any)(...args) as Singleton;
  type[GLOBAL_INSTANCE] = instance;

  if(callback)
    callback(instance);
    
  ensureDispatch(instance);

  return instance;
}