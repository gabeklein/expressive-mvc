import { issues } from './issues';
import { Model } from './model';

export const Oops = issues({
  DestroyNotPossible: (name) =>
    `${name}.destory() was called on an instance which is not active. This is an antipattern and may caused unexpected behavior.`,

  GlobalDoesNotExist: (name) =>
    `Tried to access singleton ${name} but one does not exist! Did you forget to initialize?\nCall ${name}.create() before attempting to access, or consider using ${name}.use() here instead.`,
    
  GlobalExists: (name) =>
    `Shared instance of ${name} already exists! '${name}.use(...)' may only be mounted once at any one time.`
})

export class Singleton extends Model {
  static current?: Singleton = undefined;

  static create<T extends typeof Model>(
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
      Oops.DestroyNotPossible(meta.name).warn();
  }
}