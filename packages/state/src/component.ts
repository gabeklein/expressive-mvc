import { Context } from './context';
import { set } from './instruction/set';
import { State } from './state';

const PENDING = new WeakMap<object, Component>();

/**
 * Per-adapter interpretation manifest. Each adapter augments this interface to
 * declare how it renders; the first member is `node` - the element type produced
 * by `Component.render`. Canonical elements slot in later as additional members
 * via the same augmentation - no new seam.
 *
 * ```ts
 * // @expressive/react
 * declare module '@expressive/state' {
 *   interface Host { node: React.ReactNode }
 * }
 * ```
 *
 * Only one adapter is expected per compilation; two augmenting `node` with
 * different types in the same build would conflict - by design.
 */
export interface Host {}

/**
 * Host element type produced by `Component.render`.
 * Resolves to `unknown` until an adapter augments {@link Host} with `node`.
 */
export type Node = Host extends { node: infer T } ? T : unknown;

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

    if (copy)
      return copy;

    PENDING.set(props, this);

    this.props = props;
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
