/**
 * Controller-Component Lifecycle
 * 
 * Target contains available lifecycle callbacks. 
 * A controller, when subscribed to within a component, will
 * call these respectively to that component's lifecycle.
 */
interface Lifecycle {
  didMount?(...args: any[]): void;
  didRender?(...args: any[]): void;
  willRender?(...args: any[]): void;
  willReset?(...args: any[]): void;
  willUpdate?(...args: any[]): void;
  willMount?(...args: any[]): void;
  willUnmount?(...args: any[]): void;

  elementDidMount?(...args: any[]): void;
  elementWillRender?(...args: any[]): void;
  elementWillUpdate?(...args: any[]): void;
  elementWillMount?(...args: any[]): void;
  elementWillUnmount?(...args: any[]): void;

  componentDidMount?(...args: any[]): void;
  componentWillRender?(...args: any[]): void;
  componentWillUpdate?(...args: any[]): void;
  componentWillMount?(...args: any[]): void;
  componentWillUnmount?(...args: any[]): void;
}

export = Lifecycle;