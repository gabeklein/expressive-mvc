import { useEffect, useMemo } from 'react';

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

  export interface LifecycleMethods {
    willReset?(...args: any[]): void;
    willDestroy?(callback?: Callback): void;
    willLoseFocus?(parent: this, as: string): void;
    willMount?(...args: any[]): void;
    willRender?(...args: any[]): void;
    willUnmount?(...args: any[]): void;
    willUpdate?(...args: any[]): void;
  
    didCreate?(): void;
    didFocus?(parent: this, as: string): void;
    didMount?(...args: any[]): void;
    didRender?(...args: any[]): void;
  
    elementDidMount?(...args: any[]): void;
    elementWillMount?(...args: any[]): void;
    elementWillRender?(...args: any[]): void;
    elementWillUnmount?(...args: any[]): void;
    elementWillUpdate?(...args: any[]): void;
  
    componentDidMount?(...args: any[]): void;
    componentWillMount?(...args: any[]): void;
    componentWillRender?(...args: any[]): void;
    componentWillUnmount?(...args: any[]): void;
    componentWillUpdate?(...args: any[]): void;
  }

export const lifecycle = {
  WILL_RESET: "willReset",
  WILL_RENDER: "willRender",
  WILL_UPDATE: "willUpdate",
  WILL_MOUNT: "willMount",
  WILL_UNMOUNT: "willUnmount",
  DID_RENDER: "didRender",
  DID_MOUNT: "didMount"
} as const;

function aliasFor(prefix: string){
  const map = {} as BunchOf<string>;

  for(const name of Object.values(lifecycle))
    map[name] = prefix + name[0].toUpperCase() + name.slice(1);

  return (name: string) => map[name] as LivecycleEvent;
}

export const subscriberLifecycle = aliasFor("element");
export const componentLifecycle = aliasFor("component");

export function useLifecycleEffect(
  onEvent: (name: LivecycleEvent) => void){

  let isFirstRender: true | undefined;

  onEvent = useMemo(() => (isFirstRender = true, onEvent), []);

  onEvent(isFirstRender ? lifecycle.WILL_MOUNT : lifecycle.WILL_UPDATE);
  onEvent(lifecycle.WILL_RENDER);

  useEffect(() => {
    onEvent(lifecycle.DID_RENDER);
    return () => onEvent(lifecycle.WILL_RESET);
  })

  useEffect(() => {
    onEvent(lifecycle.DID_MOUNT);
    return () => onEvent(lifecycle.WILL_UNMOUNT);
  }, [])
}