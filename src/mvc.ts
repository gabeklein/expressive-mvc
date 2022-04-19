import { useFromContext } from './context';
import { useActive, useComputed, useModel, usePassive, useTap } from './hooks';
import { Model } from './model';
import { usePeerContext } from './peer';

export class MVC extends Model {
  tap(path?: string | Function, expect?: boolean){
    return useTap(this, path, expect);
  }

  use(callback?: (instance: Model) => void){
    return useModel(this, callback);
  }

  static new(callback?: (instance: Model) => void){
    return usePassive(this, callback);
  }

  static get(arg?: boolean | string){
    return useFromContext(this, arg);
  }

  static tap(key?: string, expect?: boolean): any {
    return this.get().tap(key, expect);
  }

  static use(callback?: (instance: Model) => void){
    const instance = useModel(this, callback);
    usePeerContext(instance.get);    
    return instance;
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