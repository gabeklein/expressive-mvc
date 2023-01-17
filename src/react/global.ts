import { Control } from '../control';
import { InstanceOf } from '../helper/types';
import { Model } from '../model';
import { MVC, Oops, Global as Active } from './mvc';

export class Global extends MVC {
  static global = true;
  static keepAlive = true;

  end(force?: boolean){
    const type = this.constructor as typeof Global;
    
    if(type.keepAlive && !force)
      return false;

    Control.for(this).clear();
    Active.delete(type);
    return true;
  }

  /**
   * Update the active instance of this class.
   * Returns a thenable; resolves after successful update.
   * If instance does not already exist, one will be created. 
   */
  static set<T extends typeof Global>(
    this: T, values: Model.Compat<InstanceOf<T>, Global>){

    return this.get(true).set(values);
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
    const current = Active.get(this) as Global;

    if(current)
      current.end(true);
  }
}