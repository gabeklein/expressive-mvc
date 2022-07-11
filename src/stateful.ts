import { Controller } from './controller';
import { PENDING } from './instruction/apply';
import { CONTROL, Stateful } from './model';
import { Callback } from './types';
import { defineProperty } from './util';

type EnsureCallback<T extends Stateful> = (control: Controller<T>) => Callback | void;

function ensure<T extends Stateful>(subject: T): Controller<T>;
function ensure<T extends Stateful>(subject: T, cb: EnsureCallback<T>): Callback;
function ensure<T extends {}>(subject: T): Controller<T & Stateful>;

function ensure<T extends Stateful>(subject: T, cb?: EnsureCallback<T>){
  let control = subject[CONTROL];

  if(!control)
    defineProperty(subject, CONTROL, {
      value: control =
        new Controller(subject as unknown as Stateful)
    });

  if(!control.state){
    const { waiting } = control;

    if(cb){
      let done: Callback | void;

      waiting.add(() => {
        done = cb(control);
      });

      return () => done && done();
    }

    control.state = new Map();

    for(const key in subject)
      control.add(key);

    const callback = Array.from(waiting);

    waiting.clear();
    
    for(const cb of callback)
      cb();
  }

  return cb ? cb(control) : control;
}

export { ensure, PENDING }