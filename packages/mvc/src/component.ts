import { Context } from './context';
import { set } from './field/set';
import { State, unbind } from './state';

const PENDING = new WeakMap<object, Component>();

/** Per-class composed content render. */
const CHAIN = new WeakMap<Function, Function>();

/**
 * Adapter seam. An adapter installs a factory at this key on `Component.prototype`;
 * core consults it per instance, handing over the composed content and installing
 * the host render returned. Shared via the global symbol registry - adapters use
 * the same `Symbol.for(...)`, no import needed. A symbol (not the `render` slot)
 * because State binds prototype *methods* into accessors, which would clobber it.
 */
const SEAM = Symbol.for('@expressive/mvc.adapter');

declare namespace Component {
  /**
   * Per-adapter interpretation manifest. Each adapter augments this interface to
   * declare how it renders; the first member is `node` - the element type produced
   * by `Component.render`. Canonical elements slot in later as additional members
   * via the same augmentation - no new seam.
   *
   * ```ts
   * // @expressive/react
   * declare module '@expressive/mvc' {
   *   namespace Component { interface Host { node: React.ReactNode } }
   * }
   * ```
   *
   * Only one adapter is expected per compilation; two augmenting `node` with
   * different types in the same build would conflict - by design.
   */
  interface Host { }

  /**
   * Host element type produced by `Component.render`.
   * Resolves to `unknown` until an adapter augments {@link Host} with `node`.
   */
  type Node = Host extends { node: infer T } ? T : unknown;

  interface BaseProps<T extends Component> {
    /** Callback for newly created instance. Only called once. */
    is?: (instance: T) => void;

    /** Fallback to show when suspended or in error recovery. */
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
   * per instance (see `fold`); subclasses override with a method.
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
      configurable: true,
      writable: true,
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
  const T = target.constructor;
  let content = CHAIN.get(T);

  if (!content) {
    const chain = new Set<Function>();
    let proto = target;

    while ((proto = Object.getPrototypeOf(proto)) !== Component.prototype) {
      const desc = Object.getOwnPropertyDescriptor(proto, 'render');
      if (desc) chain.add(unbind(desc.value || desc.get!.call(target)));
    }

    CHAIN.set(T, content = fold(Array.from(chain).reverse()));
  }

  // Hand content to the adapter (if any) to wrap as a host render; else use it
  // directly. Consulted per instance - the wrap may close over the instance.
  const adapt = (Component.prototype as any)[SEAM] as Function | undefined;
  return adapt ? adapt.call(target, content) : content;
}

/**
 * Fold a content chain (base-first) into one render. Lazy and top-down: the
 * head (outermost) runs first and receives the recursively-composed tail as a
 * `children` getter, so each layer is computed within the stack of its wrapper.
 * An adapter's seam can thus establish context (hooks) that inner renders observe.
 */
function fold([fn, ...rest]: Function[]): Function {
  if (!fn) return passthrough;
  if (!rest.length) return fn;

  const inner = fold(rest);

  return function (this: Component, props?: {}): Component.Node {
    const self = this;
    return fn.call(self, {
      ...props,
      get children() { return inner.call(self, props) }
    });
  };
}

/** Default content when a component defines no `render` - pass children through. */
function passthrough(this: Component, props?: {}): Component.Node {
  const { children } = (props || this.props) as { children?: Component.Node };
  return children || null;
}

export { Component };
