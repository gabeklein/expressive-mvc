import { State, Context, watch, METHOD } from '@expressive/mvc';
import { ReactNode } from 'react';
import { provide } from './context';
import { AsComponent, FC, HasProps, Props, RenderProps } from './component';

export const Pragma = {} as {
  useState<S>(initial: () => S): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => () => void, deps?: any[]): void;
  createElement(type: any, props?: any, ...children: any[]): any;
};

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

type ForceRefresh = {
  /** Request a refresh for current component. */
  (): void;

  /**
   * Request a refresh and again after promise either resolves or rejects.
   *
   * @param waitFor Promise to wait for.
   * @returns Promise which resolves, after refresh, to same value as `waitFor`.
   */
  <T = void>(waitFor: Promise<T>): Promise<T>;

  /**
   * Request refresh before and after async function.
   * A refresh will occur both before and after the given function.
   *
   * **Note:** Any actions performed before first `await` will occur prior to refresh.
   *
   * @param invoke Async function to invoke.
   * @returns Promise which resolves returned value after refresh.
   */
  <T = void>(invoke: () => Promise<T>): Promise<T>;
};

type GetFactory<T extends State, R> = (
  this: T,
  current: T,
  refresh: ForceRefresh
) => R;

type GetEffect<T extends State> = (
  this: T,
  current: T,
  refresh: ForceRefresh
) => null;

type UseArgs<T extends State> = T extends {
  use(...props: infer P): any;
}
  ? P
  : State.Args<T>;

declare namespace ReactState {
  export import Extends = State.Extends;
  export import Type = State.Type;
  export import Args = State.Args;
  export import Init = State.Init;
  export import Assign = State.Assign;
  export import Field = State.Field;
  export import Event = State.Event;
  export import Export = State.Export;
  export import Value = State.Value;
  export import Setter = State.Setter;
  export import OnEvent = State.OnEvent;
  export import OnUpdate = State.OnUpdate;
  export import Values = State.Values;
  export import Partial = State.Partial;
  export import Ref = State.Ref;
  export import Effect = State.Effect;
  export import EffectCallback = State.EffectCallback;

  export { GetFactory, GetEffect, UseArgs, HasProps };
}

abstract class ReactState extends State {
  /**
   * Optional hook is called when State.use() is invoked within a React component.
   *
   * This is called *every render* of the component, and will intercept
   * arguments which would otherwise be merged into the State.
   *
   * @param props Arguments passed to State.use().
   */
  protected use?(...props: any[]): Promise<void> | void;

  /**
   * Create and manage instance of this State within React component.
   *
   * @param args Arguments to pass to constructor or `use` method (if defined).
   * @returns Managed instance of this State.
   */
  static use<T extends ReactState>(
    this: State.Type<T>,
    ...args: UseArgs<T>
  ): T {
    const ambient = Context.use();
    const state = Pragma.useState(() => {
      let ready: boolean | undefined;
      let active: T;

      let use = (...args: State.Args<T>): Promise<unknown> | void =>
        Promise.all(
          args
            .flat()
            .map(
              (arg) =>
                typeof arg == 'object' && instance.set(arg as State.Assign<T>)
            )
        );

      // Create instance - pass args to constructor if no use method
      const instance = new this((x) => {
        if (x instanceof ReactState && x.use) {
          use = x.use?.bind(x);
          use(...args);
        } else return args;
      });

      const context = ambient.push(instance);

      watch(instance, (current) => {
        active = current;

        if (ready) state[1]((x) => x.bind(null));
      });

      function didMount() {
        ready = true;
        return () => {
          context.pop();
          instance.set(null);
        };
      }

      return (...args: State.Args<T>) => {
        Pragma.useEffect(didMount, []);

        if (ready) {
          ready = false;

          Promise.resolve(use(...args)).finally(() => (ready = true));
        }

        return active;
      };
    });

    return state[0](...args);
  }

  /** Fetch instance of this class from context. */
  static get<T extends State>(this: State.Extends<T>): T;

  /** Fetch instance of this class optionally. */
  static get<T extends State>(
    this: State.Extends<T>,
    required: false
  ): T | undefined;

  /** Fetch instance of this class from context. */
  static get<T extends State>(
    this: State.Extends<T>,
    requireValues: true
  ): Required<T>;

  static get<T extends State, R>(
    this: State.Extends<T>,
    factory: GetFactory<T, Promise<R> | R>
  ): NoVoid<R>;

  // TODO: eagerly match this so any nulls are caught - would prevent updates.
  static get<T extends State>(
    this: State.Extends<T>,
    factory: GetEffect<T>
  ): null;

  static get<T extends State, R>(
    this: State.Extends<T>,
    argument?: boolean | GetFactory<T, unknown>
  ) {
    const context = Context.use();
    const state = Pragma.useState(() => {
      const instance = context.get(this);

      if (!instance)
        if (argument === false) return () => undefined;
        else throw new Error(`Could not find ${this} in context.`);

      let ready: boolean | undefined;
      let value: any;

      function render() {
        state[1]((x) => x.bind(null));
      }

      function refresh<T>(action?: Promise<T> | (() => Promise<T>)): any {
        if (typeof action == 'function') action = action();

        render();

        if (action) return action.finally(render);
      }

      const unwatch = watch(
        instance,
        (current) => {
          if (typeof argument === 'function') {
            const next = argument.call(current, current, refresh);

            if (next === value) return;

            value = next;
          } else value = current;

          if (ready) render();
        },
        argument === true
      );

      if (value instanceof Promise) {
        let error: Error | undefined;

        unwatch();

        value
          .then(
            (x) => (value = x),
            (e) => (error = e)
          )
          .finally(render);

        value = null;

        return () => {
          if (error) throw error;

          return value === undefined ? null : value;
        };
      }

      if (value === null) {
        unwatch();
        return () => null;
      }

      function onMount() {
        ready = true;
        return unwatch;
      }

      return () => {
        Pragma.useEffect(onMount, []);
        return value === undefined ? null : value;
      };
    });

    return state[0]() as R;
  }

  static as<T extends AsComponent, P extends State.Assign<T>>(
    this: State.Type<T>,
    render: (props: P, self: T) => ReactNode
  ): FC<T, P> {
    const FC = Render.bind(this as State.Type, { render } as {});

    return Object.assign(FC, {
      displayName: this.name,
      State: this
    });
  }
}

export function Render<T extends AsComponent>(
  this: State.Type<T>,
  props: Props<T>,
  props2?: Props<T>
) {
  const { is, ...rest } = { ...props, ...props2 };

  const ambient = Context.use();
  const state = Pragma.useState<(props: any) => any>(() => {
    const instance = this.new(rest as {}, is && ((x) => void is(x)));
    const context = ambient.push(instance);

    let ready: boolean | undefined;
    let active: T;

    watch(instance, (current) => {
      active = current;

      if (ready) state[1]((x) => x.bind(null));
    });

    function didMount() {
      ready = true;
      return () => {
        context.pop();
        instance.set(null);
      };
    }

    function Render(props: Props<T>) {
      const render = METHOD.get(active.render) || props.render || active.render;

      return render
        ? render.call(active, props as HasProps<T>, active)
        : props.children;
    }

    return (props: RenderProps<T>) => {
      ready = false;

      Pragma.useEffect(didMount, []);
      Promise.resolve(instance.set(props as {})).finally(() => {
        ready = true;
      });

      return provide(
        context,
        Pragma.createElement(Render, props as any),
        props.fallback || active.fallback,
        String(instance)
      );
    };
  });

  return state[0](rest);
}

export { ReactState };
export { AsComponent, Props };
