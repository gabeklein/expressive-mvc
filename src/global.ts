import { Controller, Singleton } from './controller';

export const OWN_SINGLETON = Symbol("controller_singleton");

export const controllerIsGlobalError = (name: string) => new Error(
  `Controller ${name} is tagged as global. Context API does not apply.`
)

export function globalController(
  type: typeof Controller, 
  args: any[] = [],
  callback?: (self: Controller) => void
){
  let instance = type[OWN_SINGLETON] as Singleton;

  if(instance)
    return instance;

  instance = new (type as any)(...args);
  type[OWN_SINGLETON] = instance;

  if(callback)
    callback(instance);
    
  instance.initialize();

  return instance;
}