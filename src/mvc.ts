import { useContext } from './context';
import { useActive, useComputed, useModel, useNew, usePassive, useTag, useTap } from './hooks';
import { Key, KeyFactory } from './lifecycle';
import { Model } from './model';

export class MVC extends Model {
  tap(path?: string | Function, expect?: boolean){
    return useTap(this, path, expect);
  }

  tag(id?: Key | KeyFactory<this>){
    return useTag(this, id);
  }

  use(callback?: (instance: Model) => void){
    return useNew(this, callback);
  }

  static new(callback?: (instance: Model) => void){
    return usePassive(this, callback);
  }

  static get(key?: boolean | string){
    const instance = useContext(this, key !== false);
  
    return (
      typeof key == "string" ?
        (instance as any)[key] :
        instance
    )
  }

  static tap(key?: string, expect?: boolean): any {
    return this.get().tap(key, expect);
  }

  static tag(id?: Key | ((target: Model) => Key | undefined)){
    return this.get().tag(id);
  }

  static use(callback?: (instance: Model) => void){
    return useModel(this, callback);
  }

  static uses(props: BunchOf<any>, only?: string[]){
    return this.use(instance => {
      instance.import(props, only);
    })
  }

  static using(props: BunchOf<any>, only?: string[]){
    const instance = this.use();
    instance.import(props, only);
    return instance;
  }

  static meta(path: string | Function, expect?: boolean): any {
    return typeof path == "function"
      ? useComputed(this, path, expect)
      : useActive(this, path, expect)
  }
}