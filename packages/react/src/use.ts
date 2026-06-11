import { event, observer, watch } from '@expressive/mvc';
import { Runtime } from './runtime';

export function use<T extends object>(subject: T) {
  const { current } = Runtime.useRef<{
    proxy: T;
    source?: T;
    mounted: number;
    unwatch?: () => void;
  }>({ mounted: 0, proxy: subject });

  const update = Runtime.useState(() => current.mounted++)[1];

  if (current.source !== subject) {
    const status = observer(subject);

    if (status === undefined)
      throw new Error('Provided object is not observable.');

    current.unwatch?.();
    current.source = subject;

    if (status === null) {
      current.unwatch = undefined;
      current.proxy = subject;
    } else {
      if (!status.ready) event(subject);

      let init = true;

      current.unwatch = watch(subject, (next, changed) => {
        current.proxy = next;
        if (changed.length && !init)
          update((x) => x + 1);
      });

      init = false;
    }
  }

  Runtime.useEffect(() => () => {
    if (--current.mounted < 1) current.unwatch?.();
  }, []);

  return current.proxy;
}
