import { Model } from '@expressive/mvc';
import { onCleanup } from 'solid-js';

import { createProxy } from './signals';

declare module '@expressive/mvc' {
  namespace Model {
    function use <T extends Model> (
      this: Model.Init<T>,
      apply?: Model.Assign<T>
    ): Model.Reactive<T>;
  }
}

Model.use = function <T extends Model> (
  this: Model.Init<T>,
  argument?: Model.Assign<T>){
 
  const instance = this.new(argument);
  const proxy = createProxy(instance);

  onCleanup(() => instance.set(null));
  
  return proxy;
}