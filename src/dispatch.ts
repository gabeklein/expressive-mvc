import type { Model } from './model';

export const UPDATE = new WeakMap<{}, readonly string[]>();

export function applyUpdate(
  subject: {}, keys: readonly string[]){

  UPDATE.set(subject, keys);

  return () => {
    setTimeout(() => {
      UPDATE.delete(subject);
    }, 0);
  }
}

export function getUpdate<T extends {}>(subject: T){
  return UPDATE.get(subject) as readonly Model.Field<T>[];
}