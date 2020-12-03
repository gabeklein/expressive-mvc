import { Singleton as Public } from "../"
import { Controller, Model, State } from './controller';

import Oops from './issues';

export class Singleton
  extends Controller
  implements Public {

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
    let instance = Type.current as State<T>;

    if(instance)
      throw Oops.GlobalExists(this.name);

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
    return (props: any) => [].concat(props.children);
  }
}