import { FunctionComponentElement, ProviderProps } from 'react';

import { Set } from './polyfill';
import { SUBSCRIBE, UNSUBSCRIBE, DISPATCH, NEW_SUB, SOURCE } from './controller';

export type BunchOf<T> = { [key: string]: T }

export type State = LiveState & BunchOf<any>

export type Class = new(...args: any[]) => any;

export type UpdateTrigger = (beat: number) => void;

export interface LiveState<State = any> {
  refresh(): void;
  add(key: string, initial?: any): void;
  export(): State;
}

export interface SpyController extends ModelController {
  [UNSUBSCRIBE]: () => void;
  [SUBSCRIBE]: () => void;
}

export declare class ModelController { 

  local: BunchOf<any>;

  didInit?(): void;
  willDestroy(callback?: () => void): void;
  toggle(key: string): boolean;

  willRender?(...args: any[]): void;
  willMount?(...args: any[]): void;
  willUpdate?(...args: any[]): void;
  didMount?(...args: any[]): void;
  willUnmount?(...args: any[]): void;

  elementWillRender?(...args: any[]): void;
  elementWillMount?(...args: any[]): void;
  elementWillUpdate?(...args: any[]): void;
  elementDidMount?(...args: any[]): void;
  elementWillUnmount?(...args: any[]): void;

  componentWillRender?(): void;
  componentWillMount?(): void;
  componentWillUpdate?(): void;
  componentDidMount?(): void;
  componentWillUnmount?(): void;

  on(...args: string[]): this;
  not(...args: string[]): this;
  only(...args: string[]): this;
  once(): this;

  watch(props: BunchOf<any>): this;
  refresh(keys: string[]): void;
  
  [NEW_SUB]: (hook: UpdateTrigger) => SpyController;
  [SOURCE]: BunchOf<any>;
  [DISPATCH]: BunchOf<Set<UpdateTrigger>>;
  
  Provider: FunctionComponentElement<ProviderProps<this>>;
}