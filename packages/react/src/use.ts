import { event, observer, watch } from '@expressive/state';
import { Runtime } from './runtime';

function ready(observable: object) {
  const status = observer(observable);

  if (status === null)
    throw new Error('Provided object is no longer observable.');

  if (!status)
    throw new Error('Provided object is not observable.');

  if (!status.ready) event(observable);
}

export function use<T extends object>(subject: T) {
  const { current } = Runtime.useRef<{
    source?: T;
    subject: T;
  }>({ subject });

  const [, update] = Runtime.useState(() => 0);

  if (current.source !== subject)
    ready(current.source = current.subject = subject);

  Runtime.useEffect(() => {
    return watch(subject, (next, changed) => {
      const previous = current.subject;
      current.subject = next;
      if (changed.length || previous !== next) update((x) => x + 1);
    });
  }, [subject]);

  return current.subject;
}
