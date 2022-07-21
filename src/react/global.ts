import { ensure } from '../controller';
import { issues } from '../issues';
import { Model } from '../model';
import { Class, InstanceOf } from '../types';
import { MVC } from './mvc';

export const Oops = issues({
  DoesNotExist: (name) =>
    `Tried to access singleton ${name}, but none exist! Did you forget to initialize?\nCall ${name}.create() before attempting to access, or consider using ${name}.use() instead.`,

  AlreadyExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing, or use ${name}.reset() to force-delete it.`
})

const Active = new WeakMap<typeof Global, Global>();

export class Global extends MVC {
  static create<T extends Class>(
    this: T, ...args: any[]){

    if(Active.has(this))
      throw Oops.AlreadyExists(this.name);

    const instance = new this(...args);

    ensure(instance);
    Active.set(this, instance);

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
    return instance.update(false);
  }

  /**
   * **React Hook** - Fetch most instance of this controller from context, if it exists.
   * 
   * @param required - If false, may return undefined.
   */
  static get <T extends Class> (this: T, required: false): InstanceOf<T> | undefined;

  /**
   * **React Hook** - Fetch most instance of this controller from context.
   * 
   * @param required - Unless false, will throw where instance cannot be found.
   */
  static get <T extends Class> (this: T, required?: boolean): InstanceOf<T>;

  /**
   * **React Hook** - Fetch specific value from instance of this controller in context.
   */
  static get <T extends Class, K extends Model.Field<InstanceOf<T>>> (this: T, key: K): InstanceOf<T>[K];

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
      current.destroy();
  }

  destroy(){
    super.destroy();
    Active.delete(this.constructor as any);
  }
}