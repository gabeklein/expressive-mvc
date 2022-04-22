import { Controller } from '../controller';
import { CONTROL, Model } from '../model';
import { useAmbient, useModel, useNew, useTap } from './hooks';
import { usePeerContext } from './peer';

export class MVC extends Model {
  static [CONTROL]: Controller;

  tap(path?: string | Function, expect?: boolean){
    return useTap(this, path, expect);
  }

  use(callback?: (instance: Model) => void){
    return useModel(this, callback);
  }

  static get(arg?: boolean | string){
    return useAmbient(this, arg);
  }

  static tap(key?: string, expect?: boolean): any {
    return useTap(this.get(), key, expect);
  }

  static new(callback?: (instance: Model) => void){
    return useNew(this, callback);
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
    return useTap(() => this, path, expect);
  }
}