import { watch, unbind } from '@expressive/state';
import React, {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { Context, Layers, Provide } from './context';
import { State } from './state';

const PENDING = new WeakMap<object, Component>();

export type StateProps<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};

type RenderProps<T> = T extends { render(props: infer P): any }
  ? {} extends P
    ? { children?: ReactNode }
    : P
  : { children?: ReactNode };

interface ComponentProps<T extends Component> {
  /** Callback for newly created instance. Only called once. */
  is?: (instance: T) => void;

  /** Fallback to show when suspended or in error recovery. */
  fallback?: ReactNode;
}

export type Props<T extends Component> = StateProps<T> &
  ComponentProps<T> &
  RenderProps<T>;

declare module '@expressive/state' {
  namespace State {
    export type { Component, Props };
  }
}

class Component extends State {
  static contextType = Layers;

  /**
   * All JSX attributes passed to this component.
   * Includes state-derived props, render props, and built-in props like `is` and `fallback`.
   *
   * Will incorperate extra props you declare as props parameter in `render` method.
   */
  readonly props!: Props<this>;

  /** @deprecated Only to satisfy React JSX. Use `this.get(State)` instead. */
  declare readonly context: Context;
  /** @deprecated Only to satisfy React JSX. Use `this.get()` instead. */
  declare readonly state: State.Values<this>;
  /** @deprecated Only to satisfy React JSX. Not implemented. */
  declare setState: (state: any, callback?: () => void) => void;
  /** @deprecated Only to satisfy React JSX. Not implemented. */
  declare forceUpdate: (callback?: () => void) => void;

  /**
   * Content to display while this component or its children are suspended.
   * Will cover suspense by pending properties in `this.render` as well.
   * Can be set as a class property or overridden via the `fallback` JSX prop.
   *
   * Defaults to null - nothing will be rendered.
   */
  fallback: ReactNode = null;

  constructor(nextProps: any, ...rest: any[]) {
    const { is, ...props } = nextProps;
    rest = rest.filter((x) => !(x instanceof Context));
    super(props, rest, is && ((x: any) => void is(x)));

    const existing = PENDING.get(nextProps);
    if (existing) return existing;
    PENDING.set(nextProps, this);

    this.props = nextProps;
    this.set('props', () => {
      this.set(this.props as {});
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
  render(props?: {}): ReactNode {
    return this.props.children || null;
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

Object.defineProperties(Component.prototype, {
  isReactComponent: {
    get() {
      return true;
    }
  },
  state: {
    get(this: Component) {
      return this.get();
    },
    set() {}
  },
  context: {
    configurable: true,
    set: bootstrap
  }
});

function bootstrap(this: Component, context: Context) {
  const self = this.is;
  const render = unbind(this.render);

  context = context.push(self);

  let mounts = 0;
  let mounted = false;
  let refresh: ((next: (x: number) => number) => void) | undefined;
  let active: Component;

  watch(self, (current) => {
    active = current;
    if (refresh) refresh((x) => x + 1);
  });

  let recovering = false;

  function Render() {
    useEffect(() => {
      recovering = false;
    });
    return render.call(active, self.props);
  }

  function AsComponent() {
    refresh = useState(0)[1];

    if (!mounted) mounts++;

    useEffect(() => {
      mounted = true;
      return () => {
        if (--mounts) return;
        refresh = undefined;
        self.set(null);
        context.pop();
      };
    }, []);

    const children = createElement(Provide, {
      context,
      name: String(self),
      fallback: active.fallback,
      children: createElement(Render)
    });

    if (active.catch)
      return createElement(ErrorBoundary, {
        fallback() {
          return active.fallback;
        },
        onError(error: Error, reset: (failed?: Error) => void) {
          mounts /= 2;
          if (recovering) return reset(error);
          const suspense = active.fallback;
          Promise.resolve(active.catch!(error)).then(
            () => {
              if (!mounts) return;
              recovering = true;
              reset();
              active.fallback = suspense;
            },
            (e) => {
              if (mounts) reset(e);
            }
          );
        },
        children
      });

    return children;
  }

  Object.defineProperties(self, {
    context: {
      get: () => context,
      set() {}
    },
    render: {
      value: () => createElement(AsComponent)
    }
  });
}

interface BoundaryProps {
  children: ReactNode;
  fallback: () => ReactNode;
  onError: (error: Error, reset: (failed?: Error) => void) => void;
}

class ErrorBoundary extends React.Component<BoundaryProps> {
  state = {} as { suspend?: boolean; failed?: Error };

  static getDerivedStateFromError() {
    return { suspend: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error, (failed) => {
      this.setState(failed ? { failed } : { suspend: false });
    });
  }

  render() {
    const { state, props } = this;
    if (state.failed) throw state.failed;
    return state.suspend ? props.fallback() : props.children;
  }
}

const SEEN = new WeakSet<Function>();

function subcomponents(Type: State.Extends) {
  const proto = Type.prototype as any;

  if (SEEN.has(Type)) return true;
  SEEN.add(Type);

  for (const key of Object.getOwnPropertyNames(proto)) {
    if (!/^[A-Z]/.test(key)) continue;

    const { get, value } = Object.getOwnPropertyDescriptor(proto, key)!;

    // state bootstrap replaces methods with get/set bind pair
    // if still a plain value, it's not a method
    if (!get && typeof value !== 'function') continue;

    const original = value || get;

    Object.defineProperty(proto, key, {
      configurable: true,
      get(this: Component) {
        const self = this.is;

        // preempt auto-bind defining non-configurable property
        Object.defineProperty(self, key, {
          configurable: true,
          writable: true
        });

        let render = get ? unbind(get.call(this)) : original;

        function Sub(props: any) {
          const ref = useRef<((props: any) => any) | null>(null);
          const next = useState(0)[1];

          if (!ref.current) ref.current = init();

          return ref.current(props);

          function init() {
            let active: Component;
            let mounts = 0;

            const release = watch(self, (current) => {
              active = current;
              next((x) => x + 1);
            });

            return (props: any) => {
              mounts++;

              useEffect(
                () => () => {
                  if (--mounts) return;
                  release();
                  ref.current = null;
                },
                []
              );

              return render.call(active, props);
            };
          }
        }

        Object.defineProperty(self, key, {
          configurable: true,
          get: () => Sub,
          set(fn: Function) {
            render = fn;
          }
        });

        return Sub;
      }
    });
  }
}

Component.on((self) => {
  let Type = self.constructor as State.Extends;

  while (Type !== Component) {
    if (subcomponents(Type)) break;
    Type = Object.getPrototypeOf(Type);
  }
});

export { Component };
