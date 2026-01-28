import { Context, watch, METHOD } from '@expressive/mvc';

import { ReactState as ReactState } from './state';
import { provide } from './context';
import { Pragma } from './adapter';

export function Render<T extends ReactState.AsComponent>(
  this: ReactState.Class<T>,
  props: ReactState.Props<T>,
  props2?: ReactState.Props<T>
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

    function Render(props: ReactState.Props<T>) {
      const render = METHOD.get(active.render) || props.render || active.render;

      return render
        ? render.call(active, props as ReactState.HasProps<T>, active)
        : props.children;
    }

    return (props: ReactState.RenderProps<T>) => {
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
