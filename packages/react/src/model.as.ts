import { Context, createEffect, METHOD, Model } from '@expressive/mvc';
import { createElement, FunctionComponent, ReactNode } from 'react';

import { provide } from './context';
import { React } from './compat';

declare module '@expressive/mvc' {
  namespace Model {
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
  const state = React.useState<(props: any) => any>(() => {
    const instance = new this(rest as {}, is && ((x) => void is(x)));

    let ready: boolean | undefined;
    let current: T;

    context.include(instance);

    const unwatch = createEffect(instance, (watch) => {
      current = watch;

      if (ready) state[1]((x: any) => x.bind(null));
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

      React.useEffect(didMount, []);

      return provide(
        context,
        createElement(Render, props as any),
        props.fallback || current.fallback,
        String(instance)
      );
    };
  });

  return state[0](rest);
}
