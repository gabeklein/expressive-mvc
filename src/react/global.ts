import { Control } from '../control';
import { issues } from '../issues';
import { Model } from '../model';
import { Class, InstanceOf } from '../types';
import { MVC } from './mvc';

export const Oops = issues({
  DoesNotExist: (name) =>
    `Tried to access singleton ${name}, but none exist! Did you forget to initialize?\nCall ${name}.new() before attempting to access, or consider using ${name}.use() instead.`,

  AlreadyExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing, or use ${name}.reset() to force-delete it.`
})

const Active = new WeakMap<Class, Global>();

export class Global extends MVC {
  constructor(){
    super();
    Active.set(this.constructor as Class, this);
  }

  kill(force?: boolean){
    const type = this.constructor as typeof Global;
    
    if(type.keepAlive && !force)
      return false;

    Control.for(this).clear();
    Active.delete(type);
    return true;
  }

  static keepAlive = true;

  static new<T extends Class>(
    this: T, ...args: ConstructorParameters<T>){

    if(Active.has(this))
      if((this as any).keepAlive)
        return Active.get(this) as InstanceOf<T>;
      else
        throw Oops.AlreadyExists(this.name);

    const instance = new this(...args);

    Control.for(instance);

    return instance as InstanceOf<T>;
  }

  /**
   * Update the active instance of this class.
   * Returns a thenable; resolves after successful update.
   * If instance does not already exist, one will be created. 
   */
  static set<T extends typeof Global>(
    this: T, values: Model.Compat<InstanceOf<T>, Global>){

    return this.get(true).update(values);
  }

  /**
   * **React Hook** - Fetch most instance of this controller from context, if it exists.
   * 
   * @param required - If false, may return undefined.
   */
  static get <T extends Global> (this: Model.Type<T>, required: false): T | undefined;

  /**
   * **React Hook** - Fetch most instance of this controller from context.
   * 
   * @param required - Unless false, will throw where instance cannot be found.
   */
  static get <T extends Global> (this: Model.Type<T>, required?: boolean): T;

  /**
   * **React Hook** - Fetch specific value from instance of this controller in context.
   */
  static get <T extends Global, K extends Model.Field<T, Global>> (this: Model.Type<T>, key: K): T[K];

  static get(arg?: boolean | string){
    const instance = Active.get(this);

    if(!instance && arg !== false)
      throw Oops.DoesNotExist(this.name);

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
      current.kill(true);
  }
}