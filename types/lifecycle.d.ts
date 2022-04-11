declare namespace Lifecycle {
  type Key = string | symbol | number;
}

/**
 * Model-Component Lifecycle
 * 
 * Target contains available lifecycle callbacks. 
 * A controller, when subscribed to within a component, will
 * call these respectively to that component's lifecycle.
 */
interface Lifecycle {
  didMount?(tag?: Lifecycle.Key): void;
  willRender?(tag?: Lifecycle.Key): void;
  willUpdate?(tag?: Lifecycle.Key): void;
  willMount?(tag?: Lifecycle.Key): void;
  willUnmount?(tag?: Lifecycle.Key): void;

  elementDidMount?(tag: Lifecycle.Key): void;
  elementWillRender?(tag: Lifecycle.Key): void;
  elementWillUpdate?(tag: Lifecycle.Key): void;
  elementWillMount?(tag: Lifecycle.Key): void;
  elementWillUnmount?(tag: Lifecycle.Key): void;

  componentDidMount?(): void;
  componentWillRender?(): void;
  componentWillUpdate?(): void;
  componentWillMount?(): void;
  componentWillUnmount?(): void;
}

export = Lifecycle;