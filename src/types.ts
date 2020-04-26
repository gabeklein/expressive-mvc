import { FunctionComponentElement, ProviderProps } from 'react';

import { RENEW_CONSUMERS } from './bootstrap';
import { Dispatch } from './dispatch';
import { SUBSCRIBE, UNSUBSCRIBE } from './subscriber';

export type BunchOf<T> = { [key: string]: T }
export type State = LiveState & BunchOf<any>
export type Class = new(...args: any[]) => any;
export type HandleUpdatedValue<T extends object, P extends keyof T> = 
  (this: T, value: T[P], changed: P) => void
export type Callback = () => void;

export interface LifeCycle {
  didMount?(...args: any[]): void;
  willMount?(...args: any[]): void;
  willRender?(...args: any[]): void;
  willUnmount?(...args: any[]): void;
  willUpdate?(...args: any[]): void;
  willCycle(...args: any[]): Callback;
  isReady?(): void;
}

export interface LiveState<State = any> {
  refresh(): void;
  add(key: string, initial?: any): void;
  export(): State;
}

export declare class ModelController { 
  static global: boolean;
  static tap(): ModelController;

  local: BunchOf<any>;
  dispatch?: Dispatch;

  toggle(key: string): boolean;

  didFocus?(parent: ModelController, as: string): void;
  didInit?(): void;
  didMount?(...args: any[]): void;
  willDestroy(callback?: Callback): void;
  willMount?(...args: any[]): void;
  willLoseFocus?(parent: ModelController, as: string): void;
  willRender?(...args: any[]): void;
  willUnmount?(...args: any[]): void;
  willUpdate?(...args: any[]): void;
  isReady?(): void;
  willCycle(...args: any[]): Callback;

  elementDidMount?(...args: any[]): void;
  elementWillMount?(...args: any[]): void;
  elementWillRender?(...args: any[]): void;
  elementWillUnmount?(...args: any[]): void;
  elementWillUpdate?(...args: any[]): void;
  elementWillCycle(...args: any[]): Callback;

  componentDidMount?(...args: any[]): void;
  componentWillMount?(...args: any[]): void;
  componentWillRender?(...args: any[]): void;
  componentWillUnmount?(...args: any[]): void;
  componentWillUpdate?(...args: any[]): void;
  componentWillCycle(...args: any[]): Callback;

  observe<P extends keyof this>(key: P | P[], listener: HandleUpdatedValue<this, P>, once?: boolean): Callback;

  not(...args: string[]): this;
  on(...args: string[]): this;
  only(...args: string[]): this;

  assign(props: BunchOf<any>): this;
  refresh(...keys: string[]): void;
  
  [RENEW_CONSUMERS]?: Callback;
  [UNSUBSCRIBE]?: Callback;
  [SUBSCRIBE]?: Callback;
  
  Provider: FunctionComponentElement<ProviderProps<this>>;
}