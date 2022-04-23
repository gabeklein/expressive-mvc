import { issues } from '../issues';
import { MVC } from './mvc';

export const Oops = issues({
  GlobalDoesNotExist: (name) =>
    `Tried to access singleton ${name}, but none exist! Did you forget to initialize?\nCall ${name}.create() before attempting to access, or consider using ${name}.use() instead.`,
    
  GlobalExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing, or use ${name}.reset() to force-delete it.`
})

const Active = new WeakMap<typeof Global, Global>();

export class Global extends MVC {
  static create<T extends Class>(
    this: T, ...args: any[]){

    const Type: typeof Global = this as any;

    if(Active.has(Type))
      throw Oops.GlobalExists(this.name);

    const instance = super.create(...args);

    Active.set(Type, instance);

    return instance as InstanceOf<T>;
  }

  /**
   * Update the active instance of this class.
   * Returns a thenable; resolves after successful update.
   * If instance does not already exist, one will be created. 
   */
  static set<T extends typeof Global>(
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

  /** Destroy current instance of Global, if it exists. */
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