import { Controller } from './controller';
import { flush } from './instruction/from';
import type { Model, Stateful } from './model';

export const UPDATE = new WeakMap<{}, readonly string[]>();

export function getUpdate<T extends {}>(subject: T){
  return UPDATE.get(subject) as readonly Model.Field<T>[];
}

export function setUpdate<T extends Stateful>(
  control: Controller<T>,
  key: Model.Field<T>){

  const { followers, frame, waiting } = control;

  if(frame.has(key))
    return;

  else if(!frame.size)
    setTimeout(() => {
      flush(frame!);
      emitUpdate(control);
    }, 0);

  frame.add(key);

  for(const callback of followers){
    const event = callback(key, control);

    if(typeof event == "function")
      waiting.add(event);
  }
}

export function emitUpdate(control: Controller){
  const { frame, subject, waiting } = control;

  const callback = Array.from(waiting);
  const keys = Array.from(frame);

  frame.clear();
  waiting.clear();

  UPDATE.set(subject, keys);

  setTimeout(() => {
    UPDATE.delete(subject);
  }, 0);

  for(const cb of callback)
    try {
      cb();
    }
    catch(err){
      console.error(err);
    }
}

export function addListener<T extends Stateful>(
  control: Controller<T>,
  listener: Controller.OnEvent<T>){

  control.followers.add(listener);
  return () => {
    control.followers.delete(listener)
  }
}

export function clearListeners<T extends Stateful>(
  control: Controller<T>){

  const listeners = [ ...control.followers ];

  control.followers.clear();
  listeners.forEach(x => x(null, control));
}