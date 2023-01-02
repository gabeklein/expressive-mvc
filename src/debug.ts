import { Model } from "./model";
import { Controller } from "./controller";
import { Subscriber } from "./subscriber";

export const WHY = Symbol("UPDATE");
export const LOCAL = Symbol("LOCAL");
export const STATE = Symbol("STATE");
export const CONTROL = Symbol("CONTROL");

export interface Stateful {
  /** Controller for this instance. */
  [CONTROL]?: Controller;

  /** Current subscriber (if present) while used in a live context (e.g. hook or effect). */
  [LOCAL]?: Subscriber;

  /** Current state of this instance. */
  [STATE]?: Model.Values<this>;

  /**
   * Last update causing a refresh to subscribers.
   * 
   * If accessed directly, will contain all keys from last push.
   * If within a subscribed function, will contain only keys which explicitly caused a refresh.
   */
  [WHY]?: readonly Model.Event<this>[];
};