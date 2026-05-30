import { Context, set, State, unbind } from '@expressive/state';
import { Node } from './host';

const PENDING = new WeakMap<object, Component>();
const RESET = Symbol.for('React.StrictMode');

export type StateProps<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};

type RenderProps<T> = [T] extends [(props: infer P) => any]
  ? [keyof NonNullable<P>] extends [never]
  ? { children?: Node }
  : NonNullable<P>
  : { children?: Node };

interface ComponentProps<T extends Component> {
  /** Callback for newly created instance. Only called once. */
  is?: (instance: T) => void;

  /** Fallback to show when suspended or in error recovery. */
  fallback?: Node;
}

export type Props<T extends Component> = StateProps<T> &
  ComponentProps<T> &
  RenderProps<T['render']>;

declare module '@expressive/state' {
  namespace State {
    export type { Component, Props };
  }
}

export class Component extends State {
  /**
   * All JSX attributes passed to this component.
   * Includes state-derived props, render props, and built-in props like `is` and `fallback`.
   *
   * Will incorperate extra props you declare as props parameter in `render` method.
   */
  declare readonly props: Props<this>;

  /**
   * Content to display while this component or its children are suspended.
   * Will cover suspense by pending properties in `this.render` as well.
   * Can be set as a class property or overridden via the `fallback` JSX prop.
   *
   * Defaults to null - nothing will be rendered.
   */
  fallback: Node = set(null);

  constructor(nextProps: any, ...rest: any[]) {
    const { is, ...props } = nextProps;
    const seen = {} as Record<string, undefined>;
    const merge = (props: {}) => {
      for (const k in props) seen[k] = undefined;
      return { ...seen, ...props };
    };

    const existing = PENDING.get(nextProps);

    super(
      merge(props),
      rest.filter((x) => !(x instanceof Context)),
      is && ((x) => { is(x) }),
      () => {
        Object.defineProperty(this, 'props', { enumerable: false });
      }
    );

    if (existing) {
      dedupe(existing);
      return existing;
    }

    PENDING.set(nextProps, this);

    this.props = nextProps;
    this.set('props', () => {
      this.set(merge(this.props));
    });
  }

  /**
   * Output for this component. Override to define custom JSX.
   *
   * Properties accessed via `this` are reactive and will trigger a render when , in addition to props.
   *
   * Accepts optional parameter to receive extra props
   * from JSX, beyond those merged to state properties.
   *
   * To declare extra props use `props = {} as { ... }` with expected shape.
   * A default is required to satisfy TypeScript but safely ignored.
   *
   * ```ts
   * render(props = {} as { label: string }) {
   *   return <span>{props.label}</span>;
   * }
   * ```
   * Usable as:
   * ```tsx
   * <MyComponent label="Hello" />
   * ```
   *
   * These must be compatible with State-derived properties, or be unused.
   * Props you declare as not-optional will be required by the JSX element.
   *
   * Without a parameter, children are accepted by default and passed through provider.
   */
  render(props?: {}): Node {
    return (this.props as { children?: Node }).children || null;
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
 * On a host double-construct (e.g. React StrictMode hands us the same props
 * twice), capture the live instance's reactive accessors in a closure and stash
 * a one-shot restore callback under a well-known symbol. The adapter invokes it
 * if the instance re-mounts - the intervening freeze can clobber the getters.
 */
function dedupe(self: Component & { [RESET]?: () => void }) {
  const snap: PropertyDescriptorMap = {};

  for (const [key] of self) {
    const desc = Object.getOwnPropertyDescriptor(self, key);
    if (desc && 'get' in desc) snap[key] = desc;
  }

  self[RESET] = () => {
    Object.defineProperties(self, snap);
    delete self[RESET];
  }
}

/**
 * Turn a subcomponent's render fn into a live host component value. Host-specific
 * (e.g. React hooks subscription); supplied by the adapter to {@link subcomponents}.
 */
export type Bind =
  (this: Component, render: (owner: Component, props: any) => Node) => unknown;

const SEEN = new WeakSet<object>([Component.prototype]);

/**
 * Discover subcomponents (capitalized members) on an instance and, recursively,
 * its class chain - defining each as a lazily-realized host component. Each
 * prototype is decorated once (guarded by SEEN); the instance's own members are
 * processed on every call. Invoked by the adapter via `Component.on`, which
 * passes its host-specific {@link Bind}.
 */
export function subcomponents(self: State, toComponent: Bind) {
  do {
    if (SEEN.has(self)) return;

    SEEN.add(self);

    for (const key of Object.getOwnPropertyNames(self)) {
      if (!/^[A-Z]/.test(key)) continue;

      const { get, value } = Object.getOwnPropertyDescriptor(self, key)!;

      if (!get && typeof value !== 'function') continue;

      Object.defineProperty(self, key, {
        configurable: true,
        get(this: Component) {
          const owner = this.is;
          let render = unbind(get ? get.call(owner) : value);
          const made = toComponent.call(owner, (current, props) => render.call(current, props));

          Object.defineProperty(owner, key, {
            configurable: true,
            get: () => made,
            set(fn: Function) {
              render = fn;
            }
          });

          return made;
        }
      });
    }
  }
  while (self = Object.getPrototypeOf(self));
}
