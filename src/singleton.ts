import { issues } from './issues';
import { Model } from './model';

export const Oops = issues({
  GlobalDoesNotExist: (name) =>
    `Tried to access singleton ${name}, but none exist! Did you forget to initialize?\nCall ${name}.create() before attempting to access, or consider using ${name}.use() instead.`,
    
  GlobalExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing, or use ${name}.reset() to force-delete it.`
})

const Active = new WeakMap<typeof Singleton, Singleton>();

export class Singleton extends Model {
  static get current(){
    return Active.get(this);
  }

  static create<T extends typeof Model>(
    this: T, ...args: any[]){

    const Type: typeof Singleton = this as any;

    if(Active.has(Type))
      throw Oops.GlobalExists(this.name);

    let instance = super.create(...args);

    Active.set(Type, instance);

    return instance as InstanceOf<T>;
  }

  static find(){
    if(this.current)
      return this.current;

    throw Oops.GlobalDoesNotExist(this.name);
  }

  static reset(){
    if(this.current)
      this.current.destroy();
  }

  destroy(){
    super.destroy();
    Active.delete(this.constructor as any);
  }
}