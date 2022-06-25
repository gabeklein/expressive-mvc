import { Controller } from './controller';
import { PENDING } from './instruction/apply';
import { CONTROL, Stateful } from './model';
import { Callback } from './types';
import { define } from './util';

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

  if(!control.state){
    if(cb){
      let done: Callback | void;

      control.waiting.add(() => {
        done = cb(control);
      });

      return () => done && done();
    }

    control.state = new Map();

    for(const key in subject)
      control.add(key);

    control.emit();
  }

  return cb ? cb(control) : control;
}

export { ensure, PENDING }