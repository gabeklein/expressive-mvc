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
      ? ComponentProps<T> & Omit<P, keyof AsComponent>
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
    interface AsComponent extends Model.New {
      render?(props: RenderProps<this>, self: this): React.ReactNode;
      fallback?: React.ReactNode;
    }

    interface FC<
      T extends Model,
      P extends Model.Assign<T>
    > extends FunctionComponent<P & Model.Props<T>> {
      displayName?: string;
      Model: Model.Extends<T>;
    }

    function as<T extends Model, P extends Model.Assign<T>>(
      this: Model.Class<T & Model.New>,
      render: (props: P, self: T) => ReactNode
    ): FC<T, P>;
  }
}

Model.as = function <T extends Model.AsComponent, P extends Model.Assign<T>>(
  this: Model.Class<T>,
  render: (props: P, self: T) => ReactNode
): Model.FC<T, P> {
  const FC = Render.bind(this as Model.Class, { render } as {});

  return Object.assign(FC, {
    displayName: this.name,
    Model: this
  });
};

export function Render<T extends Model.AsComponent>(
  this: Model.Class<T>,
  props: Model.Props<T>,
  props2?: Model.Props<T>
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

    function Render(props: Model.Props<T>) {
      const render = METHOD.get(active.render) || props.render || active.render;

      return render
        ? render.call(active, props as Model.HasProps<T>, active)
        : props.children;
    }

    return (props: Model.RenderProps<T>) => {
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
