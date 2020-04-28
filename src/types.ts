import { FunctionComponent, ProviderProps } from 'react';

import { RENEW_CONSUMERS } from './bootstrap';
import { DISPATCH, Dispatch } from './dispatch';
import { SUBSCRIBE, UNSUBSCRIBE } from './subscription';

export type BunchOf<T> = { [key: string]: T }
export type Class = new(...args: any[]) => any;
export type Callback = () => void;
export type HandleUpdatedValue
  <T extends object, P extends keyof T> = 
  (this: T, value: T[P], changed: P) => void

export interface SlaveController {
  [UNSUBSCRIBE]?: Callback;
  [SUBSCRIBE]?: Callback;

  refresh(...keys: string[]): void;

  not(...args: string[]): this;
  on(...args: string[]): this;
  only(...args: string[]): this;
}

export interface InstanceController {
  get: this;
  set: this;

  Input: FunctionComponent<{ to: string }>;
  Value: FunctionComponent<{ of: string }>;
  Provider: FunctionComponent<ProviderProps<this>>;

  [DISPATCH]?: Dispatch;
  [RENEW_CONSUMERS]?: Callback;

  toggle(key: string): boolean;
  assign(props: BunchOf<any>): this;
  refresh(...keys: string[]): void;

  export(...args: any[]): any;
  observe<P extends keyof this>(
    key: P | P[], 
    listener: HandleUpdatedValue<this, P>, 
    once?: boolean
  ): Callback;
}

export interface ModelController { 
  isReady?(): void;
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