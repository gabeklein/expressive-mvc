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

export const lifecycleEvents = [
  "willReset",
  "willRender",
  "willUpdate",
  "willMount",
  "willUnmount",
  "didRender",
  "didMount"
];

function aliasFor(prefix: string){
  const map = {} as BunchOf<string>;

  for(const name of lifecycleEvents)
    map[name] = prefix + name[0].toUpperCase() + name.slice(1);

  return (name: string) => map[name] as LivecycleEvent;
}

export const subscriberLifecycle = aliasFor("element");
export const componentLifecycle = aliasFor("component");

export function useLifecycleEffect(
  onEvent: (name: LivecycleEvent) => void){

  let isFirstRender: true | undefined;

  onEvent = useMemo(() => (isFirstRender = true, onEvent), []);

  onEvent(isFirstRender ? "willMount" : "willUpdate");
  onEvent("willRender");

  useEffect(() => {
    onEvent("didRender");

    return () =>
      onEvent("willReset")
  })

  useEffect(() => {
    onEvent("didMount");

    return () =>
      onEvent("willUnmount");
  }, [])
}