import { Key } from "./types";

/**
 * Model-Component Lifecycle
 * 
 * Target contains available lifecycle callbacks. 
 * A controller, when subscribed to within a component, will
 * call these respectively to that component's lifecycle.
 */
interface Lifecycle {
  didMount?(tag?: Key): void;
  willRender?(tag?: Key): void;
  willUpdate?(tag?: Key): void;
  willMount?(tag?: Key): void;
  willUnmount?(tag?: Key): void;

  elementDidMount?(tag: Key): void;
  elementWillRender?(tag: Key): void;
  elementWillUpdate?(tag: Key): void;
  elementWillMount?(tag: Key): void;
  elementWillUnmount?(tag: Key): void;

  componentDidMount?(): void;
  componentWillRender?(): void;
  componentWillUpdate?(): void;
  componentWillMount?(): void;
  componentWillUnmount?(): void;
}

export = Lifecycle;