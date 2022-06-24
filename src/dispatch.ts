import { Controller } from './controller';
import type { Model } from './model';

export const UPDATE = new WeakMap<{}, readonly string[]>();

export function getUpdate<T extends {}>(subject: T){
  return UPDATE.get(subject) as readonly Model.Field<T>[];
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