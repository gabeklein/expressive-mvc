import { Control } from './control';
import { Model } from './model';
import { Subscriber } from './subscriber';

const LOCAL = Symbol("LOCAL");
const STATE = Symbol("STATE");
const UPDATE = Symbol("UPDATE");
const CONTROL = Symbol("CONTROL");

Object.defineProperties(Model.prototype, {
  [CONTROL]: {
    get(this: Model){
      return Control.get(this);
    }
  },
  [LOCAL]: {
    get(this: Model){
      return Subscriber.get(this);
    }
  },
  [STATE]: {
    get(this: Model){
      const { state } = Control.get(this)!;
      const output: any = {};

      state.forEach((value, key) => output[key] = value);

      return output;
    }
  },
  [UPDATE]: {
    get(this: Model){
      const source = Subscriber.get(this) || Control.get(this);

      if(source)
        return source.latest;
    }
  }
})

const Debug = {
  CONTROL,
  LOCAL,
  STATE,
  UPDATE
} as const;

type Debug<T extends {}> = T & {
  /** Controller for this instance. */
  [CONTROL]?: Control<T>;

  /** Current subscriber (if present) while used in a live context (e.g. hook or effect). */
  [LOCAL]?: Subscriber<T>;

  /** Current state of this instance. */
  [STATE]?: Model.Values<T>;

  /**
   * Last update causing a refresh to subscribers.
   * 
   * If accessed directly, will contain all keys from last push.
   * If within a subscribed function, will contain only keys which explicitly caused a refresh.
   */
  [UPDATE]?: readonly Model.Event<T>[];
}

export { Debug };