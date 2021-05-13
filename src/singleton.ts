import { Controller, Model } from './controller';
import { useMemoized } from "./hooks";
import { defineLazy } from "./util";

import Oops from './issues';

export class Singleton extends Controller {
  static current?: Singleton = undefined;

  static find(){
    const { current } = this;

    if(!current)
      throw Oops.GlobalDoesNotExist(this.name);
    else
      return current;
  }

  static create<T extends Model>(
    this: T,
    args: any[], 
    prepare?: (self: any) => void){

    const Type = this as unknown as typeof Singleton;
    let instance = Type.current as InstanceOf<T>;

    if(instance)
      throw Oops.GlobalExists(this.name);

    instance = super.create(args, prepare) as any;
    
    return Type.current = instance;
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

defineLazy(Singleton, {
  Provider(){
    return (props: any) => {
      useMemoized(this, []);
      return [].concat(props.children);
    }
  }
});