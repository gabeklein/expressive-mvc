import { FunctionComponent, ReactNode } from 'react';
import { State, Context, watch } from '@expressive/mvc';
import { Pragma } from './adapter';
import { Render } from './render';

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

type UseArgs<T extends ReactState> = T extends {
  use(...props: infer P): any;
}
  ? P
  : State.Args<T>;

type HasProps<T extends ReactState> = {
  [K in Exclude<keyof T, keyof ReactState>]?: T[K];
};

type ComponentProps<T extends ReactState> = HasProps<T> & {
  /**
   * Callback for newly created instance. Only called once.
   * @returns Callback to run when instance is destroyed.
   */
  is?: (instance: T) => void;

  /**
   * A fallback react tree to show when suspended.
   * If not provided, `fallback` property of the State will be used.
   */
  fallback?: React.ReactNode;
};

type Props<T extends ReactState> = T extends {
  render(props: infer P, self: any): any;
}
  ? ComponentProps<T> & Omit<P, keyof AsComponent>
  : ComponentProps<T> & { children?: React.ReactNode };

/**
 * Props which will not conflict with a State's use as a Component.
 *
 * Built-in properties must be optional, as they will always be omitted.
 */
type RenderProps<T extends ReactState> = HasProps<T> & {
  is?: never;
  get?: never;
  set?: never;
};

/** State which is not incompatable as Component in React. */
interface AsComponent extends ReactState {
  render?(props: RenderProps<this>, self: this): React.ReactNode;
  fallback?: React.ReactNode;
}

interface FC<
  T extends ReactState,
  P extends ReactState.Assign<T>
> extends FunctionComponent<P & Props<T>> {
  displayName?: string;
  State: ReactState.Extends<T>;
}

declare namespace ReactState {
  export import New = State.New;
  export import Extends = State.Extends;
  export import Class = State.Class;
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

  export {
    GetFactory,
    GetEffect,
    UseArgs,
    HasProps,
    ComponentProps,
    Props,
    RenderProps,
    AsComponent,
    FC
  };
}

abstract class ReactState extends State {
  protected use?(...props: any[]): Promise<void> | void;

  static use<T extends ReactState>(this: State.New<T>, ...args: UseArgs<T>): T {
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

          Promise.resolve(use(...args)).finally(() => {
            ready = true;
          });
        }

        return active;
      };
    });

    return state[0](...args);
  }

  static as<T extends AsComponent, P extends State.Assign<T>>(
    this: State.Class<T>,
    render: (props: P, self: T) => ReactNode
  ): FC<T, P> {
    const FC = Render.bind(this as State.Class, { render } as {});

    return Object.assign(FC, {
      displayName: this.name,
      State: this
    });
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

      function onMount() {
        ready = true;
        return unwatch;
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

      return () => {
        Pragma.useEffect(onMount, []);
        return value === undefined ? null : value;
      };
    });

    return state[0]() as R;
  }
}

declare module '@expressive/mvc' {
  namespace State {
    export import get = ReactState.get;
    export import use = ReactState.use;
    export import as = ReactState.as;
  }
}

State.get = ReactState.get;
State.use = ReactState.use;
State.as = ReactState.as;

export { ReactState };
