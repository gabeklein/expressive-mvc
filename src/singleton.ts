import { Controller } from './controller';
import { Issues } from './util';

const Oops = Issues({
  ContextNotAllowed: (name) =>
    `Controller ${name} is tagged as global. Context API does not apply.`,

  DestroyNotActive: (name) =>
    `${name}.destory() was called on an instance which is not active. ` +
    `This is an antipattern and may caused unexpected behavior.`,

  AlreadyExists: (type) =>
    `Shared instance of ${type} already exists! ` +
    `'${type}.use(...)' may only be mounted once at any one time.`,

  DoesNotExist: (name) =>
    `Tried to access singleton ${name} but one does not exist! Did you forget to initialize?\n` +
    `Call ${name}.create() before attempting to access, or consider using ${name}.use() here instead.`
})

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

  static get Provider(): never {
    throw Oops.ContextNotAllowed(this.name);
  }
}