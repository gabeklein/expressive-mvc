import { control, Controller } from '../controller';
import { Model } from '../model';
import { createValueEffect, defineLazy, defineProperty } from '../util';
import { apply } from './apply';

function createRef(
  this: Controller,
  key: string,
  cb?: AssignCallback<any>){

  const refObjectFunction =
    this.ref(key, cb && createValueEffect(cb));

  defineProperty(refObjectFunction, "current", {
    set: refObjectFunction,
    get: () => this.state[key]
  })

  return refObjectFunction;
}

export function ref<T>(
  arg?: AssignCallback<T> | Model){

  return apply<{ current: T }>(
    function ref(key){
      let value = {};

      if(typeof arg == "object"){
        const source = control(arg);
    
        for(const key in source.state)
          defineLazy(value, key, createRef.bind(source, key));
      }
      else 
        value = createRef.call(this, key, arg);

      return { value };
    }
  )
}