import { Model } from '@expressive/mvc';
import { createEffect } from "solid-js";

declare module '@expressive/mvc' {
  namespace Model {
    function use <T extends Model> (
      this: Model.Init<T>,
      apply?: Model.Assign<T>,
      repeat?: boolean
    ): T;

    function use <T extends Model> (
      this: Model.Init<T>,
      callback?: Model.Callback<T>,
      repeat?: boolean
    ): T;
  }
}

Model.use = function <T extends Model> (
  this: Model.Init<T>,
  argument?: Model.Assign<T> | Model.Callback<T>,
  repeat?: boolean){
 
  const instance = new this(argument);
  const unwatch = instance.get(current => {
    
  });
}

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';