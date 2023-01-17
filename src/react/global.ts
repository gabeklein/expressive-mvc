import { InstanceOf } from '../helper/types';
import { Model } from '../model';
import { MVC, Global as Active } from './mvc';

export class Global extends MVC {
  static global = true;
  static keepAlive = true;


  /**
   * Update the active instance of this class.
   * Returns a thenable; resolves after successful update.
   * If instance does not already exist, one will be created. 
   */
  static set<T extends typeof Global>(
    this: T, values: Model.Compat<InstanceOf<T>, Global>){

    return this.get(true).set(values);
  }

  /** Destroy current instance of Global, if it exists. */
  static reset(){
    const current = Active.get(this) as Global;

    if(current)
      current.end(true);
  }
}