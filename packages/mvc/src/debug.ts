import { Control, controls } from './control';
import { defineProperties } from './helper/object';
import { Model } from './model';

const STATE = "__state";
const UPDATE = "__update";
const CONTROL = "__control";

defineProperties(Model.prototype, {
  [CONTROL]: {
    get(this: Model){
      return controls(this);
    }
  },
  [STATE]: {
    get(this: Model){
      return { ...controls(this).state };
    }
  },
  [UPDATE]: {
    get(this: Model){
      return controls(this).latest;
    }
  }
})

const Debug = {
  CONTROL,
  STATE,
  UPDATE
} as {
  /** Use to access snapshot of Model's current state. */
  STATE: "__state";

  /**
   * Use to access snapshot of Model's latest update.
   */
  UPDATE: "__update";

  /** Use to access a Model's controller. */
  CONTROL: "__control";
}

/**
 * Generic will declare debug properties on a given Model.
 * 
 * These properties always exist at runtime, however are hidden unless you cast your Model as `Debug<T>`.
 */
type Debug<T extends Model = Model> = T & {
  /** Controller for this instance. */
  [CONTROL]?: Control<T>;

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