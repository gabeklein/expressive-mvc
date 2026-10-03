import { Context } from './context';
import { set } from './field/set';
import { State, adopt, trailing, unbind } from './state';

import type { Host } from './jsx-runtime';

const PENDING = new WeakMap<object, Component<any>>();

/** Per-class composed content render. */
let CHAIN = new WeakMap<Function, Function>();

type IfEquals<X, Y, A, B> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? A : B;

/** Keys of T which are settable (excludes get-only accessors and `readonly`). */
type Acceptable<T> = {
  [P in keyof T]-?: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P, never
  >;
}[keyof T];

type ForProps<T extends State> = {
  children?: Component.Node;
  fallback?: Component.Node | false;
  catch?: (error: Error, instance: Component) => Promise<void> | void;
} & (
  | { for: State.Extends<T>; is?: (instance: T) => void }
  | { for: T | undefined; is?: never }
) & { [K in Exclude<keyof T, keyof State> & Acceptable<T>]?: T[K] };

declare namespace Component {
  /**
   * Host element type produced by `Component.render`. Delegates to the
   * {@link Host} manifest on the jsx-runtime entry; falls back to `any`
   * until an adapter augments it with `node`. `any` (not `unknown`) so an
   * un-annotated `render` override in a host-agnostic package still emits a
   * JSX-valid return - `any` is assignable to every host's node type, where
   * `unknown` is assignable to none.
   */
  type Node = Host extends { node: infer T } ? T : any;

  interface BaseProps<T extends Component<any>> {
    /**
     * Callback for newly created instance. Only called once.
     *
     * Runs after props apply but **before** the `new()` lifecycle hook - so it
     * may configure state that `new()` then observes. To react to a fully
     * initialized instance instead, use `watch` or an effect.
     */
    is?: (instance: T) => void;

    /**
     * Fallback to show when suspended or in error recovery.
     * Pass `false` to opt out of the component's own suspense boundary,
     * letting suspension bubble to an ancestor.
     */
    fallback?: Component.Node;

    /**
     * Called when this element's content throws, in place of the class's own
     * `catch`. A returned promise retries once settled.
     */
    catch?: (error: Error, instance: T) => Promise<void> | void;
  }

  type StateProps<T extends State> = {
    [K in Exclude<keyof T, keyof Component> & Acceptable<T>]?: T[K];
  };

  type RenderProps<T> = [T] extends [(props: infer P) => any]
    ? [keyof NonNullable<P>] extends [never]
    ? { children?: Component.Node }
    : NonNullable<P>
    : { children?: Component.Node };

  type Props<T extends Component<any>> =
    & StateProps<T>
    & BaseProps<T>
    & RenderProps<T['render']>;
}

class Component<P = unknown> extends State {
  /**
   * All JSX attributes passed to this component.
   * Includes state-derived props, render props, and built-in props like `is` and `fallback`.
   *
   * Will incorperate extra props you declare as props parameter in `render` method.
   */
  declare readonly props: [P] extends [State] ? ForProps<P> : Component.Props<this>;

  /** Stable identity used when this instance is rendered in a collection. */
  declare readonly key: string;

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

  constructor(props?: any, ...rest: any[]) {
    if (props == null) props = {};

    const seen = {} as Record<string, undefined>;
    const twin = PENDING.get(props);
    const provider = new.target === Component && 'for' in props;

    if (typeof props == 'object') merge(props);

    function merge(props: {}) {
      for (const k in props) seen[k] = undefined;
      return { ...seen, ...props };
    }

    super([
      props,
      rest.filter((x) => !(x instanceof Context)),
      () => {
        const other = twin || PENDING.get(props)!;

        if (other !== this) {
          trailing(other).forEach((orphan) => orphan.set(null));
          other.set(null);
        }

        if (provider) provide(this);
        else props.is?.(this);

        Object.defineProperty(this, 'props', { enumerable: false });
        PENDING.delete(props);
      }
    ]);

    PENDING.set(props, this);

    this.props = props;
    this.set('props', () => {
      this.set(merge(this.props));
    });

    Object.defineProperty(this, 'render', {
      writable: true,
      configurable: true,
      value: compose
    });
  }

  /**
   * Output for this component. Override to define custom JSX.
   *
   * Properties accessed via `this` are reactive and trigger a render when they
   * change, in addition to props. Accepts an optional parameter to receive extra
   * props from JSX, beyond those merged to state properties; declare its shape
   * via `props = {} as { ... }`. Without a parameter (the default below),
   * children pass through.
   *
   * The constructor installs a composed `render` per instance.
   */
  render(props?: {}): Component.Node {
    const { children } = (props || this.props) as { children?: Component.Node };
    return children || null;
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
  catch?(error: Error, instance: this): Promise<void> | void;
}

/**
 * Default `key` accessor. The get/set pair keeps it off observed state.
 */
Object.defineProperty(Component.prototype, 'key', {
  configurable: true,
  get() {
    return String(this);
  },
  set(value) {
    Object.defineProperty(this, 'key', { value });
  }
});

Component.on({
  pre(self) {
    const key = Object.getOwnPropertyDescriptor(self, 'key');

    if (key?.configurable)
      Object.defineProperty(self, 'key', {
        enumerable: false,
        writable: false
      });
  }
});

function provide(self: Component<any>) {
  let input: unknown;
  let target: State | undefined;
  let owned: { mount?(): unknown } | undefined;
  let mounted = false;
  let release: unknown;

  function unmount() {
    if (typeof release == 'function') release();
    release = undefined;
  }

  const inherited = (self as { mount?(): unknown }).mount;

  Object.defineProperty(self, 'mount', {
    configurable: true,
    value() {
      const done = inherited?.call(self);

      mounted = true;
      release = owned?.mount?.();

      return () => {
        mounted = false;
        unmount();
        if (typeof done == 'function') done();
      };
    }
  });

  function sync() {
    const { for: next, is, children, fallback, catch: _catch, ...rest } = self.props as Record<string, any>;

    if (fallback === undefined) self.fallback = false;

    if (next !== input) {
      input = next;
      unmount();

      if (State.is(next)) {
        adopt(self, 'for', (target = new (next as State.Type)(rest)));
        owned = target as typeof owned;
        is?.(target);
        if (mounted) release = owned!.mount?.();
        return;
      }

      owned = undefined;
      adopt(self, 'for', (target = next instanceof State ? next : undefined));
    }

    target?.set(rest);
  }

  sync();
  self.set('props', sync);
}

/**
 * Render `this` through its class's composed content render: content renders
 * up the prototype chain, each base layer receiving the subclass's as a lazy
 * `children` getter. Falls back to passing `children` through.
 */
function compose(this: State, props?: {}) {
  const type = this.constructor;
  let render = CHAIN.get(type);

  if (!render) {
    for (let T = type; T !== Component && T !== State; T = Object.getPrototypeOf(T)) {
      const next = method(T);

      if (next) render = render ? wrap(next, render) : next;
    }

    if (!render) render = method(Component)!;

    CHAIN.set(type, render);
  }

  return render.call(this, props);
}

function method(from: Function) {
  const desc = Object.getOwnPropertyDescriptor(from.prototype, 'render');
  if (desc) return unbind(desc.get || desc.value) as Function;
}

function wrap(outer: Function, inner: Function): Function {
  return function (this: State, props?: {}) {
    const self = this;
    return outer.call(self, {
      ...props,
      get children() {
        return inner.call(self, props);
      }
    });
  };
}

/** Drop composed renders, so each is rebuilt from current prototypes. */
function rechain() {
  CHAIN = new WeakMap();
}

export { Component, compose, rechain };
