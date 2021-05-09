import Controller from '.';

declare namespace Directives {
  export function setChild <T extends typeof Controller> (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> 

  export function setParent <T extends typeof Controller> (Expects: T, required: true): InstanceOf<T>;
  export function setParent <T extends typeof Controller> (Expects: T, required?: false): InstanceOf<T> | undefined;
  
  export function setPeer <T extends Class> (type: T): InstanceOf<T>;
  
  export function setEffect <T = any> (callback: EffectCallback<T>): T | undefined;
  export function setEffect <T = any> (starting: T, callback: EffectCallback<T>): T;
  
  export function setReference <T = HTMLElement> (callback?: EffectCallback<T>): { current: T | null };
  
  export function setAction <T extends Async>(action: T): T & { allowed: boolean } | undefined;
  
  export function setEvent (callback?: EffectCallback<any>): Callback;
  
  export function setMemo <T> (compute: () => T, lazy?: boolean): T;
  
  export function setTuple <T extends readonly any[] = []> (): Readonly<T> | undefined;
  export function setTuple <T extends readonly any[]> (initial: T): Readonly<T>;
  export function setTuple <T extends {}> (initial: T): Readonly<T>;
  export function setTuple <T extends readonly any[]> (...values: T): Readonly<T>;
  
  export function setValue <T> (value: T): T; 
  
  export function setIgnored <T> (value: T): T;
  
  export function setBoundComponent <P, T = HTMLElement> (Component: Controller.Component<P, T>, to: string): React.ComponentType<P>;
  
  export function setComponent <T extends Controller, P> (component: Controller.Component<P, T>): React.ComponentType<P>;
  
  export function setParentComponent <T extends Controller, P> (component: Controller.Component<P, T>): React.ComponentType<P>;
}

export = Directives;