import { FunctionComponent, ProviderProps } from 'react';

import { ControllerDispatch, DISPATCH } from './dispatch';
import { RENEW_CONSUMERS } from './peers';
import { Subscription, SUBSCRIPTION } from './subscription';

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

export interface SubscribeController {
  [SUBSCRIPTION]?: Subscription<any>;

  onEvent(name: LivecycleEvent, args?: any[]): void;
  refresh(...keys: string[]): void;
}

export interface InstanceController {
  get: this;
  set: this;

  Input: FunctionComponent<{ to: string }>;
  Value: FunctionComponent<{ of: string }>;
  Provider: FunctionComponent<ProviderProps<this>>;

  [DISPATCH]?: ControllerDispatch;
  [RENEW_CONSUMERS]?: Callback;

  toggle(key: string): boolean;
  refresh(...keys: string[]): void;

  assign(props: BunchOf<any>): this;
  assign(key: string, props?: BunchOf<any>): any;

  tap(): this;
  tap<K extends keyof this>(key?: K): this[K];

  sub(...args: any[]): this;

  onChange<P extends keyof this>(key: P | P[]): Promise<P[]>;
  onChange<P extends keyof this>(key: P | P[], listener: HandleUpdatedValue<this, P>): void;

  export(...args: any[]): any;
  observe<P extends keyof this>(
    key: P | P[], 
    listener: HandleUpdatedValue<this, P>, 
    once?: boolean
  ): Callback;
}

export interface ModelController {
  didCreate?(): void;
  didFocus?(parent: ModelController, as: string): void;
  didMount?(...args: any[]): void;
  
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