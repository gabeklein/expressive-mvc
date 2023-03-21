import { Control, controller } from './control';
import { defineProperties } from './helper/object';
import { Model } from './model';
import { Subscriber, subscriber } from './subscriber';

const LOCAL = "$debug local";
const STATE = "$debug state";
const UPDATE = "$debug update";
const CONTROL = "$debug control";

defineProperties(Model.prototype, {
  [CONTROL]: {
    get(this: Model){
      return controller(this);
    }
  },
  [LOCAL]: {
    get(this: Model){
      return subscriber(this);
    }
  },
  [STATE]: {
    get(this: Model){
      const { state } = controller(this)!;
      const output: any = {};

      state.forEach((value, key) => output[key] = value);

      return output;
    }
  },
  [UPDATE]: {
    get(this: Model){
      return (subscriber(this) || controller(this))!.latest;
    }
  }
})

const Debug = {
  CONTROL,
  LOCAL,
  STATE,
  UPDATE
} as {
  /** Use to access Model's local Subscriber (if exists). */
  LOCAL: "$debug local";

  /** Use to access snapshot of Model's current state. */
  STATE: "$debug state";

  /**
   * Use to access snapshot of Model's latest update.
   * 
   * Note: If used within a Subscriber, update will be narrowed to the specific keys
   * which triggered a refresh (if one did).
   */
  UPDATE: "$debug update";

  /** Use to access a Model's controller. */
  CONTROL: "$debug control";
}

/**
 * Generic will declare debug properties on a given Model.
 * 
 * These properties always exist at runtime, however are hidden unless you cast your Model as `Debug<T>`.
 */
type Debug<T extends Model> = T & {
  /** Controller for this instance. */
  [CONTROL]?: Control<T>;

  /** Current subscriber (if present) while used in a live context (e.g. hook or effect). */
  [LOCAL]?: Subscriber<T>;

  /** Current state of this instance. */
  [STATE]?: Model.Export<T>;

  /**
   * Last update causing a refresh to subscribers.
   * 
   * If accessed directly, will contain all keys from last push.
   * If within a subscribed function, will contain only keys which explicitly caused a refresh.
   */
  [UPDATE]?: readonly Model.Event<T>[];
}

export { Debug };