import { Context, watch, METHOD, Model } from '@expressive/mvc';
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
      P extends Model.RenderProps<T>
    > extends FunctionComponent<P & Model.Props<T>> {
      displayName?: string;
      Model: Model.Type<T>;
    }

    function as<T extends Model, P extends Model.RenderProps<T>>(
      this: Model.Init<T>,
      render: (props: P, self: T) => ReactNode
    ): FC<T, P>;
  }
}

Model.as = function <
  T extends Model.ReactCompat,
  P extends Model.RenderProps<T>
>(
  this: Model.Init<T>,
  render: (props: P, self: T) => ReactNode
): Model.FC<T, P> {
  const FC = (props: Model.Props<T>) =>
    Render.call(this as any, props as Model.Props<T>, render as any);

  return Object.assign(FC, {
    displayName: this.name,
    Model: this
  });
};

export function Render<T extends Model.ReactCompat>(
  this: Model.Init<T>,
  props: Model.Props<T>,
  render?: (props: Model.Props<T>, self: T) => ReactNode
) {
  const ambient = Context.use();
  const state = Pragma.useState(() => {
    const { is, ...rest } = props;
    const instance = new this(rest as {}, is && ((x) => void is(x)));
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

    function Render({ is, ...props }: Model.Props<T>) {
      const method = render || METHOD.get(active.render) || active.render;

      return method
        ? method.call(active, props as Model.HasProps<T>, active)
        : props.children;
    }

    return (props: Model.HasProps<T>) => {
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

  return state[0](props);
}
