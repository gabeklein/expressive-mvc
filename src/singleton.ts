import { Controller } from './controller';

import Oops from './issues';

export class Singleton extends Controller {
  static current?: Singleton = undefined;

  static create<T extends typeof Controller>(
    this: T, ...args: any[]){

    const Type = this as unknown as typeof Singleton;
    let instance = Type.current as InstanceOf<T>;

    if(instance)
      throw Oops.GlobalExists(this.name);

    instance = super.create(...args) as any;
    
    return Type.current = instance;
  }

  static find(){
    const { current } = this;

    if(!current)
      throw Oops.GlobalDoesNotExist(this.name);
    else
      return current;
  }

  destroy(){
    super.destroy();

    const meta = this.constructor as typeof Singleton;

    if(this === meta.current)
      meta.current = undefined;
    else
      Oops.DestroyNotActive(meta.name).warn();
  }
}