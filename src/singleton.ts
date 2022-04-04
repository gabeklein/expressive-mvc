import { issues } from './issues';
import { Model } from './model';

export const Oops = issues({
  GlobalDoesNotExist: (name) =>
    `Tried to access singleton ${name}, but none exist! Did you forget to initialize?\nCall ${name}.create() before attempting to access, or consider using ${name}.use() instead.`,
    
  GlobalExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing, or use ${name}.reset() to force-delete it.`
})

const Active = new WeakMap<typeof Singleton, Singleton>();

export class Singleton extends Model {
  static create<T extends Class>(
    this: T, ...args: any[]){

    const Type: typeof Singleton = this as any;

    if(Active.has(Type))
      throw Oops.GlobalExists(this.name);

    const instance = super.create(...args);

    Active.set(Type, instance);

    return instance as InstanceOf<T>;
  }

  static update<T extends typeof Singleton>(
    this: T, updates: Partial<InstanceOf<T>>){

    const instance = Active.get(this) || this.create();
    instance.import(updates);
    return instance.update();
  }

  static get(arg?: boolean | string){
    const instance = Active.get(this);

    if(!instance && arg !== false)
      throw Oops.GlobalDoesNotExist(this.name);

    return (
      typeof arg == "string" ?
        (instance as any)[arg] :
        instance
    )
  }

  static reset(){
    const current = Active.get(this);

    if(current)
      current.destroy();
  }

  destroy(){
    super.destroy();
    Active.delete(this.constructor as any);
  }
}