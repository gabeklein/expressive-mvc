import { issues } from './issues';
import { Model } from './model';

export const Oops = issues({
  GlobalDoesNotExist: (name) =>
    `Tried to access singleton ${name}, but none exist! Did you forget to initialize?\nCall ${name}.create() before attempting to access, or consider using ${name}.use() instead.`,
    
  GlobalExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing, or use ${name}.reset() to force-delete it.`
})

const Register = new WeakMap<typeof Singleton, Singleton>();

export class Singleton extends Model {
  static get current(){
    return Register.get(this);
  }

  static create<T extends typeof Model>(
    this: T, ...args: any[]){

    const Type = this as unknown as typeof Singleton;
    let instance = Register.get(Type);

    if(instance)
      throw Oops.GlobalExists(this.name);

    instance = super.create(...args);

    Register.set(Type, instance);

    return instance as InstanceOf<T>;
  }

  static find(){
    const { current } = this;

    if(!current)
      throw Oops.GlobalDoesNotExist(this.name);
    else
      return current;
  }

  static reset(){
    if(this.current)
      this.current.destroy();
  }

  destroy(){
    super.destroy();

    Register.delete(
      this.constructor as typeof Singleton
    );
  }
}