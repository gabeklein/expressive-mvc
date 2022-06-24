import { Controller } from './controller';
import { emitUpdate } from './dispatch';
import { PENDING } from './instruction/apply';
import { CONTROL, LOCAL, Stateful } from './model';
import { Callback } from './types';
import { define, defineProperty, getOwnPropertyDescriptor } from './util';

const STATE = new Map<Stateful, Map<any, any>>();

type EnsureCallback<T extends Stateful> = (control: Controller<T>) => Callback | void;

function ensure<T extends Stateful>(subject: T): Controller<T>;
function ensure<T extends Stateful>(subject: T, cb: EnsureCallback<T>): Callback;
function ensure<T extends {}>(subject: T): Controller<T & Stateful>;

function ensure<T extends Stateful>(subject: T, cb?: EnsureCallback<T>){
  let control = subject[CONTROL];

  if(!control){
    control = new Controller(subject as unknown as Stateful);
    define(subject, CONTROL, control);
  }

  let state = STATE.get(subject);

  if(!state){
    if(cb){
      let done: Callback | void;

      control.waiting.add(() => {
        done = cb(control);
      });

      return () => done && done();
    }

    STATE.set(subject, state = new Map());

    for(const key in subject){
      const { value } = getOwnPropertyDescriptor(subject, key)!;

      if(typeof value == "function")
        continue;

      if(typeof value == "symbol"){
        const instruction = PENDING.get(value);

        if(instruction)
          instruction.call(control, key, control);

        continue;
      }

      state.set(key, value);

      defineProperty(subject, key, {
        enumerable: false,
        set: control.ref(key as any),
        get(){
          const local = this[LOCAL];

          if(local && !local.watch[key])
            local.watch[key] = true;

          return state!.get(key);
        }
      });
    }

    emitUpdate(control);
  }

  return cb ? cb(control) : control;
}

export { ensure, STATE, PENDING }