import { join } from './context';
import { element } from './element';
import { listener } from './observable';
import { set } from './field/set';
import { Model, adopt, plain, trailing } from './model';

import type { Host } from './jsx-runtime';

const PENDING = new WeakMap<object, Component<any>>();

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

type ForProps<T extends Model> = {
  children?: Component.Node;
  /** Shown while children suspend - no boundary unless passed. */
  fallback?: Component.Node | false;
  catch?: (error: Error, instance: Component) => Promise<void> | void;
} & (
  | {
      /**
       * Model to provide to children - a class is constructed, owned and destroyed with this.
       *
       * Other props assign to it on every update. Changing `for` releases the previous one first.
       */
      for: Model.Extends<T>;
      /** Receives the constructed Model once; a returned plain object is assigned to it. */
      is?: (instance: T) => Model.Assign<T> | void;
    }
  | {
      /**
       * Model to provide to children - an active instance is provided as-is, never destroyed.
       *
       * An unactivated one is adopted - destroyed with this. `undefined` provides nothing. Other props
       * assign to it on every update. Changing `for` releases the previous one first.
       */
      for: T | undefined;
      is?: never;
    }
) & { [K in Acceptable<Pick<T, Exclude<keyof T, keyof Model>>>]?: T[K] };

declare namespace Component {
  /**
   * What `render` returns - the host's node type.
   *
   * Read from the `Host` manifest on `@expressive/mvc/jsx-runtime`; `any` until an adapter augments
   * it with `node`. `any`, not `unknown` - an un-annotated `render` in a host-agnostic package stays
   * assignable to every host's node type.
   */
  type Node = Host extends { node: infer T } ? T : any;

  /** Props every Component accepts beside its fields: `is`, `fallback`, `catch`. */
  interface BaseProps<T extends Component<any>> {
    /**
     * Receives the new instance once - after props apply, before `new()`.
     *
     * A returned plain object is assigned once, like props - a seed `new()` then sees. Later props
     * updates do not call it again.
     */
    is?(instance: T): Model.Assign<T> | void;

    /**
     * Shown while content suspends or `catch` recovers - assigns the `fallback` field.
     *
     * `false` - no boundary of its own; suspension reaches an ancestor.
     */
    fallback?: Component.Node;

    /**
     * Error handler for this placement - replaces the class's `catch`.
     *
     * Same contract as `Component.catch`: a returned promise renders content again once settled.
     */
    catch?(error: Error, instance: T): Promise<void> | void;
  }

  /** Optional props from settable fields - accessors without a setter and `readonly` fields excluded. */
  type ModelProps<T extends Model> = {
    [K in Acceptable<Pick<T, Exclude<keyof T, keyof Component>>>]?: T[K];
  };

  /** @deprecated Renamed to `ModelProps`. */
  type StateProps<T extends Model> = ModelProps<T>;

  /** Props declared by `render`'s parameter - `{ children? }` when it takes none. */
  type RenderProps<T> = [T] extends [(props: infer P) => any]
    ? [keyof NonNullable<P>] extends [never]
    ? { children?: Component.Node }
    : NonNullable<P>
    : { children?: Component.Node };

  /** Every prop a Component accepts: settable fields, `BaseProps`, and its `render` parameter. */
  type Props<T extends Component<any>> =
    & ModelProps<T>
    & BaseProps<T>
    & RenderProps<T['render']>;
}

/**
 * A Model a host renders as an element - fields are props, `render` its output.
 *
 * Without `render`, children pass through. Props assign to fields on construction and on every
 * update; a prop omitted later resets its field to `undefined`. Bare `Component` given `for` provides
 * one Model to its children.
 *
 * @example
 * class Counter extends Component {
 *   count = 0;
 *
 *   render() {
 *     return this.count;
 *   }
 * }
 */
class Component<P = unknown> extends Model {
  /**
   * Every prop passed - field props, `render`'s declared props, `is`, `fallback`, `catch`, `children`.
   *
   * Assigning a new object applies it - field props are written; one passed before and absent now
   * resets to `undefined`. Non-enumerable once active. With `P` a Model, typed for `for`.
   */
  declare readonly props: [P] extends [Model] ? ForProps<P> : Component.Props<this>;

  /**
   * Identity when rendered in a collection - the instance id (`String(this)`) by default.
   *
   * Not observed state. Override as a `readonly` field for an app-defined key. A write locks it - a
   * second throws.
   */
  declare readonly key: string;

  /**
   * Shown while content suspends - a pending field read in `render` included - or `catch` recovers.
   *
   * Defaults to `null` - nothing. The `fallback` prop assigns it. `false` - no boundary of its own;
   * suspension reaches an ancestor. Bare `Component` given `for` defaults to `false` unless the prop
   * is passed.
   */
  fallback: Component.Node = set(null);

  /**
   * Construct from props - assigned to fields before `is`, then `new()`.
   *
   * `rest` are Model arguments - a context places the instance there. A leading function in place of
   * props runs as a Model init callback. Two instances built from one props object are twins - the
   * first to activate destroys the other.
   */
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
      rest,
      () => {
        const other = twin || PENDING.get(props)!;

        if (other !== this) {
          trailing(other).forEach((orphan) => orphan.set(null));
          other.set(null);
        }

        let out: unknown;

        if (provider) provide(this);
        else out = props.is?.(this);

        Object.defineProperty(this, 'props', { enumerable: false });
        PENDING.delete(props);

        if (plain(out)) return out;
      }
    ]);

    PENDING.set(props, this);

    this.props = props;
    this.set('props', () => {
      this.set(merge(this.props));
    });
  }

  /**
   * What the instance renders - children by default.
   *
   * Fields read through `this` subscribe; the host renders again when they change. A parameter
   * declares extra props beside fields - typed into `props`; non-optional ones are required. A subclass
   * replaces it like any method; `super.render(props)` wraps it.
   *
   * @example
   * class Card extends Component {
   *   title = '';
   *
   *   render(props = {} as { tone?: string }) {
   *     return [this.title, props.tone];
   *   }
   * }
   */
  render(props?: {}): Component.Node {
    const { children } = (props || this.props) as { children?: Component.Node };
    return children || null;
  }

  /**
   * Error boundary - receives what content below throws while rendering.
   *
   * Declaring it, or passing the `catch` prop, makes the placement a boundary; the prop takes
   * precedence. While a returned promise is pending `fallback` shows - assign `this.fallback` for
   * error UI. Once it settles, content renders again.
   *
   * @example
   * class Panel extends Component {
   *   async catch(error: Error) {
   *     this.fallback = error.message;
   *     await retryClicked;
   *   }
   * }
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
  setup(self) {
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
  let target: Model | undefined;
  let owned: Model | undefined;
  let provided: (() => void) | undefined;

  function remove() {
    if (provided) provided();
    provided = undefined;
  }

  function sync() {
    const { for: next, is, children, fallback, catch: _catch, ...rest } = self.props as Record<string, any>;

    if (fallback === undefined) self.fallback = false;

    if (next !== input) {
      input = next;
      remove();

      if (Model.is(next)) {
        owned = target = new (next as Model.Type)(rest);
      } else {
        owned = undefined;
        target = next instanceof Model ? next : undefined;
      }

      if (target) provided = join(self, target, true);
      adopt(self, 'for', target);

      if (owned) {
        const out = is?.(owned);

        if (plain(out)) owned.set(out);

        return;
      }
    }

    target?.set(rest);
  }

  sync();
  self.set('props', sync);
  listener(self, remove, null);
}

element(Component);

export { Component };
