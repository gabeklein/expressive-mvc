import { apply } from './controller';
import { createValueEffect, define, defineLazy, defineProperty } from './util';

export function on<T>(
  initial: T, cb: InterceptCallback<T>): T {

  return apply(
    function on(key){
      this.manage(key, initial, cb && createValueEffect(cb));
    }
  );
}

export function memo<T>(
  factory: () => T, defer?: boolean): T {

  return apply(
    function memo(key){
      const source = this.subject;
      const get = () => factory.call(source);

      if(defer)
        defineLazy(source, key, get);
      else
        define(source, key, get())
    }
  );
}

export function lazy<T>(value: T): T {
  return apply(
    function lazy(key){
      const source = this.subject as any;

      source[key] = value;
      defineProperty(this.state, key, {
        get: () => source[key]
      });
    }
  );
}