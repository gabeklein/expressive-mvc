import { Control, control, getState, parent } from './control';
import { Model } from './model';

const STATE = "__state";
const UPDATE = "__update";
const CONTROL = "__control";
const PARENT = "__parent";

Object.defineProperties(Model.prototype, {
  [CONTROL]: {
    get(this: Model){
      return control(this);
    }
  },
  [STATE]: {
    get(this: Model){
      return { ...getState(this) };
    }
  },
  [UPDATE]: {
    get(this: Model){
      return control(this).frame;
    }
  },
  [PARENT]: {
    get(this: Model){
      return parent(this);
    }
  }
})

const Debug = {
  CONTROL,
  STATE,
  UPDATE,
  PARENT
} as {
  /** Use to access snapshot of Model's current state. */
  STATE: "__state";

  /**
   * Use to access snapshot of Model's latest update.
   */
  UPDATE: "__update";

  /** Use to access a Model's controller. */
  CONTROL: "__control";

  /** Use to access a Model's parent, if exists. */
  PARENT: "__parent";
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
  [UPDATE]?: Model.Values<T>;

  /**
   * Parent currently assigned to parent. Usually the model which this one is a property of.
   */
  [PARENT]?: Model;
}

export { Debug };