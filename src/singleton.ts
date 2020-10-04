import { Noop } from './components';
import { Controller } from './controller';

import Oops from './issues';

export class Singleton extends Controller {

  static current?: Singleton = undefined;

  static find(){
    if(!this.current)
      throw Oops.DoesNotExist(this.name);

    return this.current as unknown as Controller;
  }

  static create<T extends Class>(
    this: T,
    args: any[], 
    prepare?: (self: any) => void){

    const Type = this as unknown as typeof Singleton;
    let instance = Type.current as InstanceType<T>;

    if(instance)
      throw Oops.AlreadyExists(this.name);

    instance = super.create(args, prepare) as any;
    Type.current = instance;
    
    return instance;
  }

  destroy(){
    super.destroy();

    const meta = this.constructor as typeof Singleton;

    if(this === meta.current)
      meta.current = undefined;
    else
      Oops.DestroyNotActive(meta.name).warn();
  }

  static get Provider(){
    this.use();
    return Noop;
  }
}