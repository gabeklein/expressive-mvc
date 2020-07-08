import { OBSERVER, Observer } from './observer';
import { SUBSCRIPTION, Subscription } from './subscription';

export type BunchOf<T> = { [key: string]: T }
export type Class = new(...args: any[]) => any;
export type Callback = () => void;
export type HandleUpdatedValue
  <T extends object, P extends keyof T> = 
  (this: T, value: T[P], changed: P) => void

export type LivecycleEvent =
  | "willMount"
  | "willUpdate"
  | "willRender"
  | "didRender"
  | "willReset"
  | "didMount"
  | "willUnmount"
  | "componentWillMount"
  | "componentWillUpdate"
  | "componentWillRender"
  | "componentDidMount"
  | "componentWillUnmount"
  | "elementWillMount"
  | "elementWillUpdate"
  | "elementWillRender"
  | "elementDidMount"
  | "elementWillUnmount";

export interface Observable {
  [OBSERVER]: Observer<any>;

  on(key: string | string[], listener: HandleUpdatedValue<this, any>): Callback;
  
  once(target: string, listener: HandleUpdatedValue<this, any>): void;
  once(target: string): Promise<any> | undefined;

  refresh(...keys: string[]): void;

  observe<P extends keyof this>(
    key: P | P[], 
    listener: HandleUpdatedValue<this, P>, 
    once?: boolean
  ): Callback;
}

export interface SubscribeController {
  [SUBSCRIPTION]?: Subscription;

  use: this;
  
  refresh(...keys: string[]): void;
  onEvent(name: LivecycleEvent, args?: any[]): void;
}

export interface ModelController {
  didCreate?(): void;
  didFocus?(parent: ModelController, as: string): void;
  didMount?(...args: any[]): void;
  didRender?(...args: any[]): void;

  willReset?(...args: any[]): void;
  willDestroy?(callback?: Callback): void;
  willLoseFocus?(parent: ModelController, as: string): void;
  willMount?(...args: any[]): void;
  willRender?(...args: any[]): void;
  willUnmount?(...args: any[]): void;
  willUpdate?(...args: any[]): void;
  willCycle?(...args: any[]): Callback;

  elementDidMount?(...args: any[]): void;
  elementWillMount?(...args: any[]): void;
  elementWillRender?(...args: any[]): void;
  elementWillUnmount?(...args: any[]): void;
  elementWillUpdate?(...args: any[]): void;
  elementWillCycle?(...args: any[]): Callback;

  componentDidMount?(...args: any[]): void;
  componentWillMount?(...args: any[]): void;
  componentWillRender?(...args: any[]): void;
  componentWillUnmount?(...args: any[]): void;
  componentWillUpdate?(...args: any[]): void;
  componentWillCycle?(...args: any[]): Callback;
}