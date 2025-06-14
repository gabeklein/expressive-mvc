import { addListener } from '../control';
import { Model } from '../model';
import { use } from './use';

export function array<T>(){
  return use((key, subject, state) => {

    return {
      value: [],
      set(value: T[]) {
        if (Array.isArray(value)) {
          subject.splice(0, subject.length, ...value);
        } else {
          throw new TypeError('Expected an array');
        }
      }
    }
  });
}

const NOTIFY = new WeakMap<WatchArray, (start?: number, end?: number) => {}>();

type Unwrap<T> = T extends Model ? Model.State<T> : T;

class WatchArray<T = unknown> extends Array<T> {
  constructor(...items: T[]) {
    super(...items);
    addListener(this as any, () => null);
  }

  slice(start?: number, end?: number): T[] {
    const result = super.slice(start, end);
    NOTIFY.get(this)?.(start, end);
    return result;
  }

  get?(){
    return this.map(item => {
      if(item instanceof Model)
        return item.get();

      return item;
    }) as Unwrap<T>;
  }
}