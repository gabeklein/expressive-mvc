import { useEffect } from 'react';

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
  "willCycle",
  "willRender",
  "willUpdate",
  "willMount",
  "willUnmount",
  "didRender",
  "didMount"
];

const eventsFor = (prefix: string) => {
  const map = {} as BunchOf<string>;
  for(const name of lifecycleEvents)
    map[name] = prefix + name[0].toUpperCase() + name.slice(1);
  return map;
}

export const subscriberLifecycle = eventsFor("element");
export const componentLifecycle = eventsFor("component");
export const allLifecycleEvents = [
  ...lifecycleEvents,
  ...Object.values(subscriberLifecycle),
  ...Object.values(componentLifecycle)
];

export function useLifecycleEffect(
  onEvent: (name: LivecycleEvent) => void,
  initial?: boolean){

  onEvent(initial ? "willMount" : "willUpdate");
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