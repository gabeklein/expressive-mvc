import { Context, createEffect, METHOD, Model } from '@expressive/mvc';
import { FunctionComponent, ReactNode } from 'react';

import { provide } from './context';
import { Pragma } from './adapter';

declare module '@expressive/mvc' {
  namespace Model {
    type HasProps<T extends Model> = {
      [K in Exclude<keyof T, keyof Model>]?: T[K];
    };

    type ComponentProps<T extends Model> = HasProps<T> & {
      /**
       * Callback for newly created instance. Only called once.
       * @returns Callback to run when instance is destroyed.
       */
      is?: (instance: T) => void;

      /**
       * A fallback react tree to show when suspended.
       * If not provided, `fallback` property of the Model will be used.
       */
      fallback?: React.ReactNode;
    };

    type Props<T extends Model> = T extends {
      render(props: infer P, self: any): any;
    }
      ? ComponentProps<T> & Omit<P, keyof ReactCompat>
      : ComponentProps<T> & { children?: React.ReactNode };

    /**
     * Props which will not conflict with a Model's use as a Component.
     *
     * Built-in properties must be optional, as they will always be omitted.
     */
    type RenderProps<T extends Model> = HasProps<T> & {
      is?: never;
      get?: never;
      set?: never;
    };

    /** Model which is not incompatable as Component in React. */
    interface ReactCompat extends Model {
      render?(props: RenderProps<this>, self: this): React.ReactNode;
      fallback?: React.ReactNode;
    }

    interface FC<
      T extends Model,
      P extends Model.Assign<T>
    > extends FunctionComponent<P & Model.Props<T>> {
      displayName?: string;
      Model: Model.Type<T>;
    }

    function as<T extends Model, P extends Model.Assign<T>>(
      this: Model.Init<T>,
      render: (props: P, self: T) => ReactNode
    ): FC<T, P>;
  }
}

Model.as = function <T extends Model.ReactCompat, P extends Model.Assign<T>>(
  this: Model.Init<T>,
  render: (props: P, self: T) => ReactNode
): Model.FC<T, P> {
  const FC = Component.bind(this as Model.Init, { render } as {});

  return Object.assign(FC, {
    displayName: this.name,
    Model: this
  });
};

export function Component<T extends Model.ReactCompat>(
  this: Model.Init<T>,
  props: Model.Props<T>,
  props2?: Model.Props<T>
) {
  const { is, ...rest } = { ...props, ...props2 };

  const context = Context.use(true);
  const state = Pragma.useState<(props: any) => any>(() => {
    const instance = new this(rest as {}, is && ((x) => void is(x)));

    let ready: boolean | undefined;
    let current: T;

    context.use(instance);

    const unwatch = createEffect(instance, (watch) => {
      current = watch;

      if (ready) state[1]((x) => x.bind(null));
    });

    function didMount() {
      ready = true;
      return () => {
        unwatch();
        context.pop();
        instance.set(null);
      };
    }

    function Render(props: Model.Props<T>) {
      const render =
        METHOD.get(current.render) || props.render || current.render;

      return render
        ? render.call(current, props as Model.HasProps<T>, current)
        : props.children;
    }

    return (props: Model.RenderProps<T>) => {
      ready = false;
      Promise.resolve(instance.set(props as {})).finally(() => (ready = true));

      Pragma.useEffect(didMount, []);

      return provide(
        context,
        Pragma.createElement(Render, props as any),
        props.fallback || current.fallback,
        String(instance)
      );
    };
  });

  return state[0](rest);
}
