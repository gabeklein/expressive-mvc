import { Context } from './context';
import { set } from './field/set';
import { State, unbind } from './state';

import type { Host } from './jsx-runtime';

const PENDING = new WeakMap<object, Component>();

/** Per-class composed content render. */
const CHAIN = new WeakMap<Function, Function>();

declare namespace Component {
  /**
   * Host element type produced by `Component.render`. Delegates to the
   * {@link Host} manifest on the jsx-runtime entry; resolves to `unknown`
   * until an adapter augments it with `node`.
   */
  type Node = Host extends { node: infer T } ? T : unknown;

  interface BaseProps<T extends Component> {
    /** Callback for newly created instance. Only called once. */
    is?: (instance: T) => void;

    /**
     * Fallback to show when suspended or in error recovery.
     * Pass `false` to opt out of the component's own suspense boundary,
     * letting suspension bubble to an ancestor.
     */
    fallback?: Component.Node;
  }

  type StateProps<T extends State> = {
    [K in Exclude<keyof T, keyof Component>]?: T[K];
  };

  type RenderProps<T> = [T] extends [(props: infer P) => any]
    ? [keyof NonNullable<P>] extends [never]
    ? { children?: Component.Node }
    : NonNullable<P>
    : { children?: Component.Node };

  type Props<T extends Component> =
    & StateProps<T>
    & BaseProps<T>
    & RenderProps<T['render']>;
}

interface Component {
  /**
   * Output for this component. Override to define custom JSX.
   *
   * Properties accessed via `this` are reactive and trigger a render when they
   * change, in addition to props. Accepts an optional parameter to receive extra
   * props from JSX, beyond those merged to state properties; declare its shape
   * via `props = {} as { ... }`. Without a parameter, children pass through.
   *
   * Declared, not implemented - the constructor installs a composed `render`
   * per instance (see `render`); subclasses override with a method.
   */
  render(props?: {}): Component.Node;
}

class Component extends State {
  /**
   * All JSX attributes passed to this component.
   * Includes state-derived props, render props, and built-in props like `is` and `fallback`.
   *
   * Will incorperate extra props you declare as props parameter in `render` method.
   */
  declare readonly props: Component.Props<this>;

  /**
   * Content to display while this component or its children are suspended.
   * Will cover suspense by pending properties in `this.render` as well.
   * Can be set as a class property or overridden via the `fallback` JSX prop.
   *
   * Defaults to null - nothing will be rendered.
   * Set `false` to opt out of having a boundary at all - suspension then
   * bubbles to the nearest ancestor boundary.
   */
  fallback: Component.Node = set(null);

  constructor(props: any, ...rest: any[]) {
    const seen = {} as Record<string, undefined>;
    const copy = PENDING.get(props);

    function merge(props: {}) {
      for (const k in props) seen[k] = undefined;
      return { ...seen, ...props };
    }

    super(copy ? [] : [
      merge(props),
      rest.filter((x) => !(x instanceof Context)),
      () => {
        props.is?.(this);
        Object.defineProperty(this, 'props', { enumerable: false });
        PENDING.delete(props);
      }
    ]);

    if (copy) return copy;

    PENDING.set(props, this);

    this.props = props;
    this.set('props', () => {
      this.set(merge(this.props));
    });

    Object.defineProperty(this, 'render', {
      writable: true,
      configurable: true,
      value: render(this)
    });
  }

  /**
   * Called when a child component throws during render.
   * While this is pending, `fallback` is displayed.
   * When resolved, the error boundary resets and `render` is called again.
   *
   * Override to handle errors - set `this.fallback` for error-specific UI,
   * await async recovery, or await user interaction before retrying. If you
   * assign a fallback within catch, it will be reverted after resolved.
   */
  catch?(error: Error): Promise<void> | void;
}

/**
 * Build (or fetch the cached) composed content render for an instance's class.
 * Walks the prototype chain for content renders strictly below Component - the
 * seam itself (Component.prototype.render) is excluded; an adapter owns that.
 */
function render(target: Component) {
  const cached = CHAIN.get(target.constructor);

  if (cached) return cached;

  let render: Function = children;
  let proto = target;

  while ((proto = Object.getPrototypeOf(proto)) !== Component.prototype) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'render');

    if (desc) {
      const layer = unbind(desc.get || desc.value);
      render = render === children ? layer : compose(layer, render);
    }
  }

  CHAIN.set(target.constructor, render);

  return render;
}

/** Wrap an outer render so it receives `inner` as a lazy `children` getter. */
function compose(outer: Function, inner: Function): Function {
  return function (this: Component, props?: {}) {
    const self = this;
    return outer.call(self, {
      ...props,
      get children() {
        return inner.call(self, props);
      }
    });
  };
}

/** Default content when a component defines no `render` - pass children through. */
function children(this: Component, props?: {}): Component.Node {
  const { children } = (props || this.props) as { children?: Component.Node };
  return children || null;
}

export { Component };
