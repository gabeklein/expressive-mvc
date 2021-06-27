import { issues } from './issues';
import { Model } from './model';

export const Oops = issues({
  GlobalDoesNotExist: (name) =>
    `Tried to access singleton ${name} but one does not exist! Did you forget to initialize?\nCall ${name}.create() before attempting to access, or consider using ${name}.use() here instead.`,
    
  GlobalExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing instance, or use ${name}.reset() to delete.`
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

  static reset(){
    let instance = this.current;

    if(instance)
      instance.destroy();
  }

  destroy(){
    super.destroy();

    const meta = this.constructor as typeof Singleton;

    if(this === meta.current)
      meta.current = undefined;
  }
}