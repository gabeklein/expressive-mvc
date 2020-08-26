import { Controller } from './controller';
import { defineOnAccess, Issues } from './util';

const Oops = Issues({
  ContextNotAllowed: (name) =>
    `Controller ${name} is tagged as global. Context API does not apply.`,

  DestroyNotActive: (name) =>
    `${name}.destory() was called on an instance which is not active.` +
    `This is an antipattern and may caused unexpected behavior.`,

  CantAttach: (parent, child) =>
    `Singleton '${parent}' attempted to attach '${child}'.` +
    `This is not possible because '${child}' is not also a singleton.`,

  AlreadyExists: (type) =>
    `Shared instance of ${type} already exists!` +
    `'${type}.use(...)' may only be mounted once at any one time.`,

  DoesNotExist: (name) =>
    `Tried to access singleton ${name} but one does not exist! Did you forget to initialize?\n` +
    `Call ${name}.create() before attempting to access, or consider using ${name}.use() here instead.`
})

export class Singleton extends Controller {
  destroy(){
    super.destroy();

    const constructor = 
      this.constructor as typeof Singleton;

    if(this !== constructor.current)
      Oops.DestroyNotActive(constructor.name).warn();
    else
      constructor.current = undefined;
  }

  attach(key: string, type: typeof Controller){
    if(!type.context)
      defineOnAccess(this, key, () => type.find());
    else 
      throw Oops.CantAttach(this.constructor.name, type.name)
  }

  static current?: Singleton = undefined;

  static find(){
    const instance = this.current;

    if(!instance)
      throw Oops.DoesNotExist(this.name);

    return instance;
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
  
  static delete(instance?: Singleton){
    const constructor = instance 
      ? instance.constructor as typeof Singleton
      : this;

    if(!instance)
      instance = this.current;
    else 
      
    if(!instance)
      return;

    delete constructor.current;
  }

  static extends<T extends Class>(
    this: T, type: Class): type is T {

    return type.prototype instanceof this;
  }

  static get context(): any {
    return undefined;
  }

  static get Provider(): any {
    throw Oops.ContextNotAllowed(this.name);
  }
}